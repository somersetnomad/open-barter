// Data layer. The site talks to the database only through named
// functions (see supabase/schema.sql). Live mode calls them on Supabase;
// demo mode runs the very same SQL in the browser with PGlite.

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const PGLITE_JS = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.12/dist/index.js';

export async function createBackend(config) {
  if (config.supabaseUrl && config.supabaseAnonKey) return liveBackend(config);
  return demoBackend(config);
}

// ---------------------------------------------------------------- live
async function liveBackend(config) {
  const { createClient } = await import(SUPABASE_JS);
  // PKCE puts the sign-in code in ?code=… so it never clashes with the #/page routes.
  const sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
  });
  let session = (await sb.auth.getSession()).data.session;
  const url = new URL(location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error_description')) {
    const err = url.searchParams.get('error_description');
    ['code', 'error', 'error_code', 'error_description'].forEach(k => url.searchParams.delete(k));
    history.replaceState(null, '', url.pathname + url.search + (url.hash || '#/me'));
    if (err) setTimeout(() => alert('Sign-in failed: ' + err), 0);
  }
  const listeners = new Set();
  sb.auth.onAuthStateChange((_event, s) => {
    const changed = (s?.user?.id || null) !== (session?.user?.id || null);
    session = s;
    if (changed) listeners.forEach(fn => fn());
  });

  return {
    mode: 'live',
    async rpc(name, args = {}) {
      const { data, error } = await sb.rpc(name, args);
      if (error) throw new Error(cleanError(error.message));
      return data;
    },
    userId: () => session?.user?.id || null,
    onAuthChange: fn => listeners.add(fn),
    async signIn(email) {
      const redirect = location.origin + location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
      if (error) throw new Error(cleanError(error.message));
    },
    async signOut() { await sb.auth.signOut(); },
    canUpload: true,
    async uploadPhoto(file) {
      const uid = session?.user?.id;
      if (!uid) throw new Error('Please sign in first.');
      const blob = await shrinkImage(file);
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(cleanError(error.message));
      return sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
    }
  };
}

// ---------------------------------------------------------------- demo
async function demoBackend(config) {
  const { PGlite } = await import(config.pgliteUrl || PGLITE_JS);
  const db = new PGlite('idb://open-barter-demo');
  const base = new URL('.', document.baseURI);
  const sqlFile = async path => {
    const res = await fetch(new URL(path, base));
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return res.text();
  };

  async function setup() {
    await db.exec(await sqlFile('demo/shim.sql'));
    await db.exec(await sqlFile('supabase/schema.sql'));
    await db.exec(await sqlFile('demo/seed.sql'));
  }
  const ready = await db.query(`select to_regclass('public.listings') is not null as ok`);
  if (!ready.rows[0].ok) await setup();

  const users = (await db.query(
    `select p.id, p.display_name from public.profiles p join auth.users u on u.id = p.id
     where u.email like '%@example.org' order by p.display_name`)).rows;

  let uid = null;
  try { uid = localStorage.getItem('barter-demo-user'); } catch { /* storage blocked */ }
  if (!users.some(u => u.id === uid)) uid = users[0]?.id || null;
  const listeners = new Set();

  return {
    mode: 'demo',
    demoUsers: users,
    async rpc(name, args = {}) {
      if (!/^[a-z_]+$/.test(name)) throw new Error('Bad function name');
      const keys = Object.keys(args).filter(k => /^p_[a-z_]+$/.test(k));
      const vals = keys.map(k => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
      try {
        // set_config(..., true) is transaction-local, so run both in one transaction.
        return await db.transaction(async tx => {
          await tx.query(`select set_config('demo.uid', $1, true)`, [uid || '']);
          const res = await tx.query(
            `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, vals);
          return res.rows[0].r;
        });
      } catch (e) {
        throw new Error(cleanError(e.message));
      }
    },
    userId: () => uid,
    onAuthChange: fn => listeners.add(fn),
    switchUser(id) {
      uid = id;
      try { localStorage.setItem('barter-demo-user', id || ''); } catch { /* ignore */ }
      listeners.forEach(fn => fn());
    },
    async signIn() { throw new Error('Demo mode: pick a sample member from the menu instead.'); },
    async signOut() { this.switchUser(null); },
    canUpload: false,
    async uploadPhoto() { throw new Error('Photo uploads work once the site is connected to Supabase.'); },
    async reset() {
      await db.exec(`drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;`);
      await setup();
    }
  };
}

// ------------------------------------------------------------- helpers
function cleanError(msg = '') {
  return String(msg).replace(/^error:\s*/i, '').split('\n')[0] || 'Something went wrong.';
}

// Resize photos in the browser before upload (max 1200px, JPEG).
async function shrinkImage(file, max = 1200) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
}
