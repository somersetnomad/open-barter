import cfg from '../config.js';
import { createBackend } from './api.js';

// ------------------------------------------------------------------ state
const S = { api: null, me: null, settings: null, loops: [] };
const $ = sel => document.querySelector(sel);
const main = $('#main');

// --------------------------------------------------------------- helpers
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cr = n => `${n} ${Math.abs(n) === 1 ? cfg.creditNameSingular : cfg.creditName}`;
const DELIVERY = { local: 'In person', post: 'Can post', online: 'Online' };
const STATUS = {
  proposed: 'Waiting for answers', accepted: 'Agreed: arrange the swap', completed: 'Completed',
  cancelled: 'Cancelled', disputed: 'In dispute'
};
const AVATAR_COLOURS = ['#2448C9', '#2B7148', '#8A5A0B', '#7A3E9D', '#A3261D', '#1F6F78', '#5B6B1E'];
function colourFor(id = '') {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
const initials = name => (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  const units = [[86400 * 30, 'month'], [86400 * 7, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [secs, name] of units) if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
}
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.className = 'toast'), 3800);
}
const rpc = (name, args) => S.api.rpc(name, args);
const isMe = id => S.me && S.me.id === id;
function avatar(p, size = 44) {
  return `<span class="avatar" style="background:${colourFor(p.id)};width:${size}px;height:${size}px;font-size:${size / 2.6}px" aria-hidden="true">${esc(initials(p.display_name))}</span>`;
}
function rep(p) {
  const bits = [`${p.completed} trade${p.completed === 1 ? '' : 's'}`];
  if (p.positive || p.negative) bits.push(`${p.positive} 👍 ${p.negative ? `· ${p.negative} 👎` : ''}`);
  return bits.join(', ');
}
function personChip(p) {
  return `<a class="person" href="#/profile/${p.id}" style="text-decoration:none;color:inherit">${avatar(p)}
    <span><b>${esc(p.display_name)}</b><br><span class="rep">${esc(p.area || 'No area set')} · ${esc(rep(p))}</span></span></a>`;
}
function tagCard(l) {
  const kind = l.kind === 'offer' ? 'Offering' : 'Wanted';
  return `<a class="tag ${l.kind}" href="#/listing/${l.id}">
    ${l.photo_url ? `<img class="photo" src="${esc(l.photo_url)}" alt="" loading="lazy">` : ''}
    <span class="kind">${kind}${l.is_service && l.kind === 'offer' ? ' <span class="pill">Repeatable</span>' : ''}${l.status !== 'active' ? ` <span class="pill">${esc(l.status)}</span>` : ''}</span>
    <h3>${esc(l.title)}</h3>
    <span class="muted small">${esc(l.category)}</span>
    <span class="meta"><span>${esc(l.owner.display_name)}</span><span>${esc(DELIVERY[l.delivery])}${l.area ? ' · ' + esc(l.area) : ''}</span>
      ${l.value_credits != null ? `<span class="coin">${esc(l.value_credits)}</span>` : ''}</span>
  </a>`;
}
function form2obj(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}
function opts(list, selected, blank) {
  return (blank != null ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(v => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
function areaField(name, value, label = 'Area') {
  if (cfg.areas?.length) {
    const list = cfg.areas.includes(value) || !value ? cfg.areas : [...cfg.areas, value];
    return `<label>${label}<select name="${name}">${opts(list, value, 'Choose an area')}</select></label>`;
  }
  return `<label>${label}<input type="text" name="${name}" value="${esc(value)}" maxlength="60"></label>`;
}
async function busy(btn, fn) {
  const label = btn?.textContent; if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
  try { return await fn(); }
  catch (e) { toast(e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
}

// ------------------------------------------------------------ loop drawing
// Draws people as points on a circle with arrows showing who gives to whom.
function loopSvg(legs, { labels = false, size = 240, cls = '' } = {}) {
  const n = legs.length, c = size / 2, R = size * (labels ? 0.27 : 0.34), nodeR = size * 0.085;
  const id = 'ah' + Math.random().toString(36).slice(2, 8);
  const pt = (a, r = R) => [c + r * Math.cos(a), c + r * Math.sin(a)];
  const ang = i => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const gap = (nodeR + 6) / R;
  let arcs = '', nodes = '', itemLabels = '';
  legs.forEach((g, i) => {
    const a1 = ang(i) + gap, a2 = ang((i + 1) % n) + (i + 1 === n ? 2 * Math.PI : 0) - gap;
    const [x1, y1] = pt(a1), [x2, y2] = pt(a2);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const colour = isMe(g.from) ? 'var(--offer)' : 'var(--ink-soft)';
    arcs += `<path class="arc" d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" style="stroke:${colour}" stroke-width="3" marker-end="url(#${id})"/>`;
    if (labels) {
      const mid = (a1 + a2) / 2, [lx, ly] = pt(mid, R + size * 0.12);
      const anchor = Math.abs(Math.cos(mid)) < .3 ? 'middle' : Math.cos(mid) > 0 ? 'start' : 'end';
      itemLabels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${size * 0.045}" style="fill:var(--ink)">${esc(g.label || g.offer_title || '')}</text>`;
    }
  });
  legs.forEach((g, i) => {
    const [x, y] = pt(ang(i));
    const name = g.from_name || '';
    nodes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${nodeR}" style="fill:${g.colour || colourFor(g.from)}"/>
      <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${nodeR * 0.8}" font-weight="700" fill="#fff">${esc(g.initial || initials(name))}</text>`;
  });
  return `<svg class="${cls}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(legs.map(g => `${g.from_name || ''} gives ${g.label || g.offer_title || ''}`).join(', '))}">
    <defs><marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink-soft)"/></marker></defs>
    ${arcs}${nodes}${itemLabels}</svg>`;
}

// ------------------------------------------------------------------ chrome
function renderChrome() {
  document.title = cfg.name;
  $('#brand-name').textContent = cfg.name;
  const acc = $('#account');
  if (S.me) {
    acc.innerHTML = `<a href="#/me" class="coin ${S.me.balance < 0 ? 'neg' : ''}" style="text-decoration:none" title="Your balance">${esc(S.me.balance)}</a>`;
  } else if (S.api.mode === 'live') {
    acc.innerHTML = `<a class="btn small primary" href="#/me">Sign in</a>`;
  } else acc.innerHTML = '';
  const badge = $('#trade-badge');
  badge.hidden = !(S.me && S.me.needs_action > 0);
  badge.textContent = S.me?.needs_action || '';

  const bar = $('#demo-bar');
  if (S.api.mode === 'demo') {
    bar.hidden = false;
    bar.innerHTML = `<span><b>Demo mode.</b> Sample data, saved only in this browser.</span>
      <label class="row" style="font-weight:400;gap:6px">Viewing as
        <select id="demo-user"><option value="">Signed out</option>${S.api.demoUsers.map(u =>
          `<option value="${u.id}" ${u.id === S.api.userId() ? 'selected' : ''}>${esc(u.display_name)}</option>`).join('')}</select></label>
      <button class="linkbtn" id="demo-reset">Reset demo data</button>`;
    $('#demo-user').onchange = e => S.api.switchUser(e.target.value || null);
    $('#demo-reset').onclick = async () => {
      if (!confirm('Reset all demo data to the starting sample?')) return;
      await S.api.reset(); toast('Demo data reset'); await refreshMe(); route();
    };
  }
  const links = [`<a href="#/rules">Community rules</a>`];
  if (S.me?.is_moderator) links.push(`<a href="#/mod">Moderation</a>`);
  if (cfg.sourceUrl) links.push(`<a href="${esc(cfg.sourceUrl)}">Open source code</a>`);
  $('#footer').innerHTML = `<span>${esc(cfg.name)}</span>${links.join('')}<span>Credits have no cash value.</span>`;
}

async function refreshMe() {
  try { S.me = S.api.userId() ? await rpc('get_me') : null; }
  catch (e) { S.me = null; if (S.api.userId()) toast(e.message, true); }
  renderChrome();
}

function needMe(why) {
  if (S.me) return false;
  main.innerHTML = `<div class="panel" style="max-width:520px"><h1 style="font-size:2rem">Sign in to ${esc(why)}</h1>
    ${S.api.mode === 'demo'
      ? `<p>This is the demo. Pick a sample member in the yellow bar above to try it out.</p>`
      : signInForm()}</div>`;
  bindSignIn();
  return true;
}
function needRules() {
  if (S.me.agreed_rules) return false;
  main.innerHTML = `<div class="notice warn"><p><b>One more step.</b> Please read and accept the community rules on your profile before posting or trading.</p>
    <a class="btn primary" href="#/me">Go to your profile</a></div>`;
  return true;
}
function signInForm() {
  return `<form id="signin" class="stack"><p>We'll email you a sign-in link. No password needed.</p>
    <label>Email address<input type="email" name="email" required autocomplete="email"></label>
    <button class="btn primary">Email me a sign-in link</button>
    <p class="muted small">Your email is never shown to other members.</p></form>`;
}
function bindSignIn() {
  const f = $('#signin'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    busy(f.querySelector('button'), async () => {
      await S.api.signIn(f.email.value.trim());
      f.innerHTML = `<div class="notice good">Check your inbox for a link from us. Open it on this device to sign in.</div>`;
    });
  };
}

// ------------------------------------------------------------------ views
const views = {};

views.home = async () => {
  const [stats, offers, wants] = await Promise.all([
    rpc('community_stats'), rpc('list_listings', { p_kind: 'offer', p_limit: 6 }), rpc('list_listings', { p_kind: 'want', p_limit: 6 })
  ]);
  const demoLoop = [
    { from: 'a', from_name: 'Baker', label: 'Bread', colour: '#2448C9', initial: 'B' },
    { from: 'b', from_name: 'Guitarist', label: 'Guitar lessons', colour: '#8A5A0B', initial: 'G' },
    { from: 'c', from_name: 'Mechanic', label: 'Bike repair', colour: '#2B7148', initial: 'M' }
  ];
  main.innerHTML = `
    <section class="hero">
      <div>
        <h1>${esc(cfg.heroTitle || 'Trade what you have for what you need')}</h1>
        <p class="lede">${esc(cfg.tagline)}</p>
        <p class="muted">The baker doesn't need a bike fixed, but the guitarist wants bread and the mechanic wants lessons.
          We find circles like that for you, and community ${esc(cfg.creditName)} cover the gaps.</p>
        <div class="row">
          <a class="btn primary" href="#/browse">Browse what's on offer</a>
          <a class="btn" href="${S.me ? '#/new' : '#/me'}">${S.me ? 'Post a listing' : 'Join in'}</a>
        </div>
      </div>
      <div class="hero-circle draw">${loopSvg(demoLoop, { labels: true, size: 360 })}</div>
    </section>
    <p class="stats"><span><b>${stats.members}</b>members</span><span><b>${stats.offers}</b>offers</span>
      <span><b>${stats.wants}</b>wants</span><span><b>${stats.completed_trades}</b>completed trades</span></p>
    <section class="how">
      <div><h3><span class="step">1</span>List it</h3><p class="muted">Post what you can offer, from jam to a lift to the station, and what you're after.</p></div>
      <div><h3><span class="step">2</span>Get matched</h3><p class="muted">We look for direct swaps and trade circles of up to ${S.settings.max_trade_parties} people.</p></div>
      <div><h3><span class="step">3</span>Swap and confirm</h3><p class="muted">Everyone agrees first. Contact details are shared only then. Confirm once it's done.</p></div>
    </section>
    <section><div class="section-head"><h2>Newest offers</h2><a href="#/browse?kind=offer">See all offers</a></div>
      ${offers.items.length ? `<div class="grid">${offers.items.map(tagCard).join('')}</div>` : `<p class="empty">Nothing offered yet. Be the first.</p>`}</section>
    <section style="margin-top:40px"><div class="section-head"><h2>Newest wants</h2><a href="#/browse?kind=want">See all wants</a></div>
      ${wants.items.length ? `<div class="grid">${wants.items.map(tagCard).join('')}</div>` : `<p class="empty">No wants posted yet.</p>`}</section>`;
};

views.browse = async (_p, q) => {
  const f = { q: q.get('q') || '', kind: q.get('kind') || '', category: q.get('category') || '', area: q.get('area') || '' };
  let offset = 0;
  main.innerHTML = `<h1>Browse</h1>
    <form class="filters" id="filters">
      <label>Search<input type="search" name="q" value="${esc(f.q)}" placeholder="bread, bike, lessons…"></label>
      <label>Type<select name="kind">${[['', 'Offers and wants'], ['offer', 'Offers'], ['want', 'Wants']].map(([v, t]) => `<option value="${v}" ${v === f.kind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Category<select name="category">${opts(cfg.categories, f.category, 'All categories')}</select></label>
      ${cfg.areas?.length ? `<label>Area<select name="area">${opts(cfg.areas, f.area, 'Anywhere')}</select></label>`
        : `<label>Area<input type="text" name="area" value="${esc(f.area)}"></label>`}
    </form>
    <p class="muted small" id="count"></p><div class="grid" id="results"></div>
    <p style="text-align:center;margin-top:24px"><button class="btn" id="more" hidden>Show more</button></p>`;
  const form = $('#filters');
  async function load(reset) {
    if (reset) offset = 0;
    const res = await rpc('list_listings', { p_q: f.q, p_kind: f.kind, p_category: f.category, p_area: f.area, p_limit: 24, p_offset: offset });
    const html = res.items.map(tagCard).join('');
    if (reset) $('#results').innerHTML = html || `<p class="empty" style="grid-column:1/-1">Nothing matches. Try fewer filters, or <a href="#/new">post a want</a> so people can find you.</p>`;
    else $('#results').insertAdjacentHTML('beforeend', html);
    offset += res.items.length;
    $('#count').textContent = `${res.total} listing${res.total === 1 ? '' : 's'}${f.area ? ' (local ones in ' + f.area + ', plus anything posted or online)' : ''}`;
    $('#more').hidden = offset >= res.total;
  }
  let timer;
  form.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      Object.assign(f, form2obj(form));
      history.replaceState(null, '', '#/browse?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString());
      load(true).catch(e => toast(e.message, true));
    }, 250);
  };
  form.onsubmit = e => e.preventDefault();
  $('#more').onclick = () => load(false);
  await load(true);
};

views.listing = async ([id]) => {
  const l = await rpc('get_listing', { p_id: id });
  const mine = isMe(l.owner.id);
  const kindWord = l.kind === 'offer' ? 'Offering' : 'Wanted';
  main.innerHTML = `<p><a href="#/browse">Back to browse</a></p>
  <div class="detail">
    <article>
      ${l.photo_url ? `<img class="photo" src="${esc(l.photo_url)}" alt="Photo of ${esc(l.title)}">` : ''}
      <span class="pill ${l.kind}">${kindWord}</span> ${l.status !== 'active' ? `<span class="pill">${esc(l.status)}</span>` : ''}
      <h1 style="margin-top:10px">${esc(l.title)}</h1>
      <p style="white-space:pre-wrap">${esc(l.description) || '<span class="muted">No description.</span>'}</p>
      <dl class="facts">
        <dt>Category</dt><dd>${esc(l.category)}</dd>
        <dt>How</dt><dd>${esc(DELIVERY[l.delivery])}${l.area ? ', ' + esc(l.area) : ''}</dd>
        ${l.value_credits != null ? `<dt>Rough value</dt><dd><span class="coin">${esc(cr(l.value_credits))}</span></dd>` : ''}
        ${l.kind === 'offer' ? `<dt>Available</dt><dd>${l.is_service ? 'Repeatedly (skill, service or lending)' : 'Once (one-off item)'}</dd>` : ''}
        ${l.tags.length ? `<dt>Tags</dt><dd>${l.tags.map(esc).join(', ')}</dd>` : ''}
        <dt>Posted</dt><dd>${ago(l.created_at)}</dd>
      </dl>
    </article>
    <aside class="side">
      <div class="panel">${personChip(l.owner)}</div>
      <div class="panel stack">
        ${mine ? `
          <a class="btn primary" href="#/edit/${l.id}">Edit</a>
          ${l.status === 'active' ? `<button class="btn" data-status="paused">Pause</button>` : ''}
          ${l.status === 'paused' ? `<button class="btn" data-status="active">Make active again</button>` : ''}
          ${l.kind === 'offer' && !l.is_service && l.status !== 'traded' ? `<button class="btn" data-status="traded">Mark as traded elsewhere</button>` : ''}
          <button class="btn danger" data-status="removed">Delete listing</button>`
        : l.status === 'active' ? `
          <a class="btn ${l.kind === 'offer' ? 'primary' : 'want'}" href="#/propose?listing=${l.id}">${l.kind === 'offer' ? 'Propose a trade' : 'I can help with this'}</a>
          <p class="muted small" style="margin:0">${l.kind === 'offer'
            ? `Offer something of yours, some ${esc(cfg.creditName)}, or both.`
            : `Say what you can give, and ask for ${esc(cfg.creditName)} or something of theirs.`}</p>` : `<p class="muted">This listing isn't available right now.</p>`}
        ${!mine && S.me ? `<button class="linkbtn small" id="report">Report this listing</button>` : ''}
      </div>
    </aside>
  </div>`;
  main.querySelectorAll('[data-status]').forEach(b => b.onclick = () => busy(b, async () => {
    if (b.dataset.status === 'removed' && !confirm('Delete this listing? This cannot be undone.')) return;
    await rpc('set_listing_status', { p_id: l.id, p_status: b.dataset.status });
    toast(b.dataset.status === 'removed' ? 'Listing deleted' : 'Listing updated');
    if (b.dataset.status === 'removed') location.hash = '#/me'; else route();
  }));
  const rb = $('#report'); if (rb) rb.onclick = () => report('listing', l.id);
};

async function report(kind, id) {
  const reason = prompt('What is the problem? A moderator will review it.');
  if (!reason) return;
  try { await rpc('report', { p_kind: kind, p_target: id, p_reason: reason }); toast('Report sent to the moderators'); }
  catch (e) { toast(e.message, true); }
}

views.new = async () => listingForm(null);
views.edit = async ([id]) => listingForm(await rpc('get_listing', { p_id: id }));

async function listingForm(l) {
  if (needMe('post a listing') || needRules()) return;
  const v = l || { kind: new URLSearchParams(location.hash.split('?')[1]).get('kind') || 'offer', category: '', title: '', description: '', tags: [], delivery: 'local', area: S.me.area, value_credits: null, is_service: false, photo_url: '' };
  main.innerHTML = `<div style="max-width:680px"><h1>${l ? 'Edit listing' : 'Post a listing'}</h1>
  <form class="stack" id="lf">
    <div class="segmented" role="radiogroup" aria-label="Type of listing">
      <label><input type="radio" name="kind" value="offer" ${v.kind === 'offer' ? 'checked' : ''}><span>I'm offering</span></label>
      <label><input type="radio" name="kind" value="want" ${v.kind === 'want' ? 'checked' : ''}><span>I want</span></label>
    </div>
    <label>Title<input type="text" name="title" required minlength="3" maxlength="80" value="${esc(v.title)}" placeholder="e.g. Bike repair, Sourdough loaves, Help moving a sofa"></label>
    <label>Description<span class="hint">Condition, size, when you're free, anything people should know.</span><textarea name="description" maxlength="1000">${esc(v.description)}</textarea></label>
    <div class="two">
      <label>Category<select name="category" required>${opts(cfg.categories, v.category, 'Choose a category')}</select></label>
      <label>Keywords<span class="hint">Comma separated. These help matching.</span><input type="text" name="tags" value="${esc(v.tags.join(', '))}" placeholder="bike, bicycle"></label>
    </div>
    <div class="two">
      <label>How it can happen<select name="delivery">${Object.entries(DELIVERY).map(([k, t]) => `<option value="${k}" ${k === v.delivery ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${areaField('area', v.area)}
    </div>
    <label>Rough value in ${esc(cfg.creditName)} (optional)<span class="hint">${esc(cfg.creditHint)} Helps people balance a swap.</span>
      <input type="number" name="value_credits" min="0" max="100000" value="${v.value_credits ?? ''}"></label>
    <label class="check" id="svc"><input type="checkbox" name="is_service" ${v.is_service ? 'checked' : ''}>
      <span>I can do this more than once<br><span class="muted small">For skills, services, lending or homemade things. One-off items are hidden once traded.</span></span></label>
    ${S.api.canUpload ? `<label>Photo (optional)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>
      ${v.photo_url ? `<label class="check"><input type="checkbox" name="remove_photo"><span>Remove current photo</span></label>` : ''}` : ''}
    <div class="row"><button class="btn primary">${l ? 'Save changes' : 'Post listing'}</button><a class="btn" href="${l ? '#/listing/' + l.id : '#/'}">Cancel</a></div>
  </form></div>`;
  const f = $('#lf');
  const syncSvc = () => ($('#svc').hidden = form2obj(f).kind !== 'offer');
  f.addEventListener('change', syncSvc); syncSvc();
  f.onsubmit = e => {
    e.preventDefault();
    busy(f.querySelector('button.primary'), async () => {
      const o = form2obj(f);
      let photo = o.remove_photo ? null : (v.photo_url || null);
      const file = f.photo?.files?.[0];
      if (file) photo = await S.api.uploadPhoto(file);
      const saved = await rpc('save_listing', {
        p_id: l?.id || null, p_kind: o.kind, p_category: o.category, p_title: o.title, p_description: o.description,
        p_tags: o.tags, p_delivery: o.delivery, p_area: o.area || '', p_value_credits: o.value_credits === '' ? null : Number(o.value_credits),
        p_is_service: o.kind === 'offer' && !!o.is_service, p_photo_url: photo
      });
      toast(l ? 'Changes saved' : 'Listing posted');
      location.hash = '#/listing/' + saved.id;
    });
  };
}

views.matches = async () => {
  if (needMe('see your matches')) return;
  main.innerHTML = `<h1>Your matches</h1><p class="loading">Looking for swaps and trade circles…</p>`;
  const m = await rpc('find_matches', { p_max_parties: S.settings.max_trade_parties });
  S.loops = m.loops;
  const loopHtml = m.loops.map((lp, i) => `
    <div class="panel loop-card">
      ${loopSvg(lp.legs, { cls: 'loop-svg' })}
      <div>
        <h3>${lp.size === 2 ? 'Direct swap' : `Trade circle of ${lp.size} people`}</h3>
        <ul class="legs">${lp.legs.map(g => `<li><b>${isMe(g.from) ? 'You' : esc(g.from_name)}</b><span class="arrow">give${isMe(g.from) ? '' : 's'}</span>
          <a href="#/listing/${g.listing_id}">${esc(g.offer_title)}</a><span class="arrow">to</span><b>${isMe(g.to) ? 'you' : esc(g.to_name)}</b>
          ${g.value_credits != null ? `<span class="coin small">${esc(g.value_credits)}</span>` : ''}</li>`).join('')}</ul>
        <div class="row"><button class="btn primary" data-loop="${i}">Propose this ${lp.size === 2 ? 'swap' : 'circle'}</button>
          <span class="muted small">Everyone has to agree before anything happens.</span></div>
      </div>
    </div>`).join('');
  const list = (items, empty) => items.length ? `<div class="grid">${items.map(x => tagCard(x.listing)).join('')}</div>` : `<p class="empty">${empty}</p>`;
  main.innerHTML = `<h1>Your matches</h1>
    <p class="muted" style="max-width:62ch">Matches come from your active listings: same category, shared keywords, and close enough to meet (or posted or online).
      Add keywords to your listings to get better matches.</p>
    <section class="stack-lg" style="margin:24px 0 40px"><h2>Swaps and trade circles</h2>
      ${loopHtml || `<p class="empty">No circles yet. They appear when your offers and wants link up with other people's. <a href="#/new?kind=want">Post a want</a> or <a href="#/new">an offer</a> to give us more to work with.</p>`}</section>
    <section style="margin-bottom:40px"><div class="section-head"><h2>Offers that match your wants</h2></div>
      ${list(m.offers_for_my_wants, 'Nothing yet. You can still pay for things with credits from Browse.')}</section>
    <section><div class="section-head"><h2>People who want what you offer</h2></div>
      ${list(m.wants_for_my_offers, 'Nobody has asked for your offers yet.')}</section>`;
  main.querySelectorAll('[data-loop]').forEach(b => b.onclick = () => busy(b, async () => {
    if (needRulesToast()) return;
    const lp = S.loops[+b.dataset.loop];
    const note = prompt('Add a note for everyone (optional), e.g. when you are free:', '') ?? null;
    if (note === null) return;
    const t = await rpc('propose_trade', { p_legs: lp.legs.map(g => ({ from: g.from, to: g.to, listing_id: g.listing_id })), p_note: note });
    toast('Proposal sent'); await refreshMe(); location.hash = '#/trade/' + t.id;
  }));
};
function needRulesToast() {
  if (S.me.agreed_rules) return false;
  toast('Please accept the community rules on your profile first.', true); return true;
}

views.propose = async (_p, q) => {
  if (needMe('propose a trade') || needRules()) return;
  const l = await rpc('get_listing', { p_id: q.get('listing') });
  const other = l.owner;
  if (isMe(other.id)) { location.hash = '#/listing/' + l.id; return; }
  const [theirs, mine] = await Promise.all([
    rpc('get_profile', { p_id: other.id }),
    rpc('list_listings', { p_owner: S.me.id, p_kind: 'offer', p_limit: 100 })
  ]);
  const theirOffers = theirs.listings.filter(x => x.kind === 'offer');
  const myOffers = mine.items.filter(x => x.status === 'active');
  const opt = (list, sel) => `<option value="">Nothing from this list</option>` + list.map(x =>
    `<option value="${x.id}" data-value="${x.value_credits ?? ''}" ${x.id === sel ? 'selected' : ''}>${esc(x.title)}${x.value_credits != null ? ` (about ${x.value_credits})` : ''}</option>`).join('');
  const wantNote = l.kind === 'want' ? `For your request: ${l.title}` : '';
  main.innerHTML = `<p><a href="#/listing/${l.id}">Back to the listing</a></p>
  <h1>Propose a trade with ${esc(other.display_name)}</h1>
  <form id="pf" class="stack" style="max-width:860px">
    <div class="two">
      <fieldset><legend>${esc(other.display_name)} gives you</legend>
        <label>One of their offers<select name="their_listing">${opt(theirOffers, l.kind === 'offer' ? l.id : '')}</select></label>
        <label>${esc(cap(cfg.creditName))}<input type="number" name="their_credits" min="0" value="0"></label>
        <label>Or describe it<input type="text" name="their_note" maxlength="200" placeholder="e.g. 2 jars, one hour"></label>
      </fieldset>
      <fieldset><legend>You give ${esc(other.display_name)}</legend>
        <label>One of your offers<select name="my_listing">${opt(myOffers, '')}</select></label>
        <label>${esc(cap(cfg.creditName))}<input type="number" name="my_credits" min="0" value="0"></label>
        <label>Or describe it<input type="text" name="my_note" maxlength="200" value="${esc(wantNote)}" placeholder="e.g. an hour of help"></label>
      </fieldset>
    </div>
    <p class="notice" id="balance-hint"></p>
    <label>Message (optional)<textarea name="note" maxlength="600" placeholder="When are you free? Anything to agree?"></textarea></label>
    <div class="row"><button class="btn primary">Send proposal</button><span class="muted small">Nothing is shared or moved until you both accept.</span></div>
  </form>`;
  const f = $('#pf');
  const valueOf = sel => Number(sel.selectedOptions[0]?.dataset.value || 0);
  function hint() {
    const o = form2obj(f);
    const get = valueOf(f.their_listing) + Number(o.their_credits || 0);
    const give = valueOf(f.my_listing) + Number(o.my_credits || 0);
    const after = S.me.balance + Number(o.their_credits || 0) - Number(o.my_credits || 0);
    let txt = `After this trade your balance would be <b>${esc(cr(after))}</b> (your limit is ${esc(cr(S.me.floor))}).`;
    if (get && give && get !== give) {
      const diff = get - give;
      txt += ` By the listed values you'd ${diff > 0 ? 'receive' : 'give'} about ${esc(cr(Math.abs(diff)))} more. You could ${diff > 0 ? 'add' : 'ask for'} ${esc(cr(Math.abs(diff)))} to balance it, or agree it's fair as it is.`;
    } else if (get && !give) txt += ` Their offer is valued at about ${esc(cr(get))}. You could offer that many ${esc(cfg.creditName)}.`;
    $('#balance-hint').innerHTML = txt;
    $('#balance-hint').className = 'notice' + (after < S.me.floor ? ' bad' : '');
  }
  f.oninput = hint; hint();
  f.onsubmit = e => {
    e.preventDefault();
    busy(f.querySelector('button'), async () => {
      const o = form2obj(f), me = S.me.id, them = other.id, legs = [];
      const side = (from, to, listing, credits, note) => {
        if (listing) legs.push({ from, to, listing_id: listing, note });
        else if (note) legs.push({ from, to, note });
        if (Number(credits) > 0) legs.push({ from, to, credits: Number(credits) });
      };
      side(them, me, o.their_listing, o.their_credits, o.their_note.trim());
      side(me, them, o.my_listing, o.my_credits, o.my_note.trim());
      if (!legs.length) throw new Error('Add something for at least one side of the trade.');
      const t = await rpc('propose_trade', { p_legs: legs, p_note: o.note });
      toast('Proposal sent'); await refreshMe(); location.hash = '#/trade/' + t.id;
    });
  };
};

views.trades = async () => {
  if (needMe('see your trades')) return;
  const all = await rpc('my_trades');
  const groups = [
    ['Needs your answer', all.filter(t => t.needs_action)],
    ['In progress', all.filter(t => !t.needs_action && ['proposed', 'accepted', 'disputed'].includes(t.status))],
    ['Finished', all.filter(t => ['completed', 'cancelled'].includes(t.status))]
  ];
  const row = t => {
    const others = t.parties.filter(p => !isMe(p.user.id)).map(p => p.user.display_name);
    const items = t.legs.map(g => g.listing?.title || (g.credits ? cr(g.credits) : g.note)).filter(Boolean);
    return `<a class="panel trade-row" href="#/trade/${t.id}"><span><b>With ${esc(others.join(', '))}</b><br>
      <span class="muted small">${esc(items.join(' · '))}</span></span>
      <span class="pill ${t.status === 'completed' ? 'ok' : t.status === 'disputed' || t.status === 'cancelled' ? 'bad' : ''}">${esc(STATUS[t.status])}</span></a>`;
  };
  main.innerHTML = `<h1>Your trades</h1>` + (all.length ? groups.filter(([, l]) => l.length).map(([h, l]) =>
    `<section style="margin-bottom:32px"><h2>${h}</h2><div class="stack">${l.map(row).join('')}</div></section>`).join('')
    : `<p class="empty">No trades yet. Find something on <a href="#/browse">Browse</a> or check your <a href="#/matches">matches</a>.</p>`);
};

views.trade = async ([id]) => {
  if (needMe('see this trade')) return;
  const t = await rpc('get_trade', { p_trade_id: id });
  const party = t.parties.some(p => isMe(p.user.id));
  const stages = ['proposed', 'accepted', 'completed'];
  const idx = stages.indexOf(t.status);
  const timeline = t.status === 'cancelled' || t.status === 'disputed'
    ? `<div class="timeline"><span class="now">${esc(STATUS[t.status])}</span></div>`
    : `<div class="timeline">${['Proposed', 'Everyone agreed', 'Completed'].map((s, i) =>
        `<span class="${i < idx || t.status === 'completed' ? 'done' : i === idx ? 'now' : ''}">${s}</span>`).join('')}</div>`;
  const legs = t.legs.map(g => `<li><b>${isMe(g.from) ? 'You' : esc(g.from_name)}</b><span class="arrow">give${isMe(g.from) ? '' : 's'}</span>
    ${g.listing ? `<a href="#/listing/${g.listing.id}">${esc(g.listing.title)}</a>` : ''}
    ${g.credits ? `<span class="coin">${esc(cr(g.credits))}</span>` : ''}
    ${g.note ? `<span class="muted">${g.listing || g.credits ? '(' + esc(g.note) + ')' : esc(g.note)}</span>` : ''}
    <span class="arrow">to</span><b>${isMe(g.to) ? 'you' : esc(g.to_name)}</b></li>`).join('');
  const people = t.parties.map(p => `<li><span class="person">${avatar(p.user, 34)}<a href="#/profile/${p.user.id}">${isMe(p.user.id) ? 'You' : esc(p.user.display_name)}</a></span>
    <span class="small">${t.status === 'proposed' ? (p.accepted ? '<span class="pill ok">Agreed</span>' : '<span class="pill">Waiting</span>')
      : t.status === 'accepted' ? (p.confirmed ? '<span class="pill ok">Confirmed it happened</span>' : '<span class="pill">Not confirmed yet</span>') : ''}</span></li>`).join('');

  let actions = '';
  if (party && t.status === 'proposed' && !t.my_accepted)
    actions = `<p>Do you agree to this trade?</p><div class="row"><button class="btn primary" data-act="accept">Accept</button><button class="btn" data-act="decline">Decline</button></div>`;
  else if (party && t.status === 'proposed')
    actions = `<p class="muted">You've agreed. Waiting for the others.</p><button class="btn small" data-act="cancel">Withdraw proposal</button>`;
  else if (party && t.status === 'accepted') actions = `
    <p>${t.my_confirmed ? 'You have confirmed. Waiting for the others to confirm.' : 'Once you have given and received your part, confirm it here. Credits move when everyone has confirmed.'}</p>
    <div class="row">${t.my_confirmed ? '' : `<button class="btn primary" data-act="confirm">It happened, confirm</button>`}
      ${t.parties.some(p => p.confirmed) ? '' : `<button class="btn" data-act="cancel">Cancel trade</button>`}
      <button class="btn danger" data-act="dispute">Something went wrong</button></div>`;
  else if (t.status === 'disputed') actions = `<div class="notice warn"><b>A moderator will look at this.</b><br>${esc(t.dispute_reason)}</div>
    ${S.me.is_moderator ? `<div class="row" style="margin-top:12px"><button class="btn primary" data-act="mod-complete">Moderator: complete it</button><button class="btn" data-act="mod-cancel">Moderator: cancel it</button></div>` : ''}`;
  else if (t.status === 'completed') actions = `<div class="notice good">Done. ${t.legs.some(g => g.credits) ? `${esc(cfg.creditName)} have moved.` : ''} Leave feedback below to help others trust each other.</div>`;
  else if (t.status === 'cancelled') actions = `<p class="muted">This trade was cancelled. Nothing changed hands on the site.</p>`;

  const contacts = t.contacts.length ? `<div class="panel"><h3>Contact details</h3><dl class="contacts">${t.contacts.map(c =>
    `<dt>${esc(c.display_name)}</dt><dd>${esc(c.contact) || '<span class="muted">Not given. Use the messages.</span>'}</dd>`).join('')}</dl>
    <p class="muted small" style="margin:0">Meet somewhere public for first swaps.</p></div>` : '';

  const rateable = t.status === 'completed' && party ? t.parties.filter(p => !isMe(p.user.id)).map(p => {
    const r = t.my_ratings.find(x => x.ratee === p.user.id);
    return `<form class="stack rate" data-user="${p.user.id}"><b>${esc(p.user.display_name)}</b>
      <div class="segmented"><label><input type="radio" name="positive" value="1" ${!r || r.positive ? 'checked' : ''}><span>👍 Good</span></label>
        <label><input type="radio" name="positive" value="0" ${r && !r.positive ? 'checked' : ''}><span>👎 Not good</span></label></div>
      <input type="text" name="comment" maxlength="300" placeholder="A short comment (public)" value="${esc(r?.comment || '')}">
      <button class="btn small">${r ? 'Update feedback' : 'Leave feedback'}</button></form>`;
  }).join('') : '';

  main.innerHTML = `<p><a href="#/trades">Back to your trades</a></p>
  <h1>${t.parties.length > 2 ? `Trade circle of ${t.parties.length}` : 'Trade'}</h1>${timeline}
  <div class="detail">
    <div class="stack-lg">
      <div class="panel"><h3>What moves</h3><ul class="legs">${legs}</ul>
        ${t.note ? `<p class="muted" style="margin:0">“${esc(t.note)}”</p>` : ''}</div>
      <div class="panel">${actions}</div>
      ${rateable ? `<div class="panel stack"><h3>Feedback</h3>${rateable}</div>` : ''}
      <div class="panel"><h3>Messages</h3>
        <div class="chat" id="chat">${t.messages.map(m => `<div class="msg ${isMe(m.sender) ? 'mine' : ''}"><div class="who">${esc(m.sender_name)} · ${ago(m.created_at)}</div>${esc(m.body)}</div>`).join('') || '<p class="muted">No messages yet.</p>'}</div>
        ${t.status !== 'cancelled' ? `<form id="msg" class="row" style="margin-top:12px"><input type="text" name="body" maxlength="1000" placeholder="Write a message" required style="flex:1"><button class="btn small primary">Send</button></form>` : ''}
      </div>
    </div>
    <aside class="side">
      ${t.legs.length > 1 ? `<div class="panel" style="text-align:center">${loopSvg(circleOrder(t), { cls: 'loop-svg' })}</div>` : ''}
      <div class="panel"><h3>People</h3><ul class="parties">${people}</ul></div>
      ${contacts}
      ${!contacts && t.status === 'proposed' ? `<p class="muted small">Contact details appear here once everyone has agreed.</p>` : ''}
      <button class="linkbtn small" id="report-trade" style="justify-self:start">Report a problem with this trade</button>
    </aside>
  </div>`;
  const chat = $('#chat'); chat.scrollTop = chat.scrollHeight;
  const act = async (name, b) => busy(b, async () => {
    const a = { p_trade_id: t.id };
    if (name === 'accept') await rpc('respond_trade', { ...a, p_accept: true });
    if (name === 'decline') { if (!confirm('Decline and cancel this proposal?')) return; await rpc('respond_trade', { ...a, p_accept: false }); }
    if (name === 'cancel') { if (!confirm('Cancel this trade for everyone?')) return; await rpc('cancel_trade', a); }
    if (name === 'confirm') await rpc('confirm_trade', a);
    if (name === 'dispute') { const r = prompt('What went wrong? A moderator will read this.'); if (!r) return; await rpc('dispute_trade', { ...a, p_reason: r }); }
    if (name === 'mod-complete') await rpc('mod_resolve_dispute', { ...a, p_outcome: 'complete' });
    if (name === 'mod-cancel') await rpc('mod_resolve_dispute', { ...a, p_outcome: 'cancel' });
    await refreshMe(); route();
  });
  main.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
  const mf = $('#msg');
  if (mf) mf.onsubmit = e => { e.preventDefault(); busy(mf.querySelector('button'), async () => { await rpc('send_message', { p_trade_id: t.id, p_body: mf.body.value }); route(); }); };
  main.querySelectorAll('form.rate').forEach(f => f.onsubmit = e => {
    e.preventDefault();
    busy(f.querySelector('button'), async () => {
      const o = form2obj(f);
      await rpc('rate_trade', { p_trade_id: t.id, p_ratee: f.dataset.user, p_positive: o.positive === '1', p_comment: o.comment });
      toast('Feedback saved'); route();
    });
  });
  $('#report-trade').onclick = () => report('trade', t.id);
};

// Order a trade's legs into a circle for drawing (falls back to the given order).
function circleOrder(t) {
  const legs = t.legs.map(g => ({ ...g, offer_title: g.listing?.title || (g.credits ? cr(g.credits) : g.note) }));
  const out = [], used = new Set();
  let cur = legs[0];
  while (cur && !used.has(cur)) {
    used.add(cur); out.push(cur);
    cur = legs.find(g => !used.has(g) && g.from === cur.to);
  }
  return out.length === legs.length ? out : legs;
}

views.profile = async ([id]) => {
  const p = await rpc('get_profile', { p_id: id });
  main.innerHTML = `<div class="detail"><div>
    <div class="person" style="margin-bottom:18px">${avatar(p, 64)}<div><h1 style="margin:0">${esc(p.display_name)}</h1>
      <span class="muted">${esc(p.area || 'No area set')} · joined ${ago(p.joined)}${p.is_moderator ? ' · moderator' : ''}</span></div></div>
    ${p.is_banned ? `<p class="notice bad">This member is suspended.</p>` : ''}
    ${p.bio ? `<p style="white-space:pre-wrap">${esc(p.bio)}</p>` : ''}
    <h2 style="margin-top:28px">Listings</h2>
    ${p.listings.length ? `<div class="grid">${p.listings.map(tagCard).join('')}</div>` : `<p class="empty">No active listings.</p>`}
  </div><aside class="side">
    <div class="panel"><h3>Track record</h3><dl class="facts" style="margin:0">
      <dt>Completed trades</dt><dd>${p.completed}</dd><dt>Good feedback</dt><dd>${p.positive}</dd><dt>Bad feedback</dt><dd>${p.negative}</dd>
      ${p.balance != null ? `<dt>Balance</dt><dd><span class="coin ${p.balance < 0 ? 'neg' : ''}">${esc(p.balance)}</span></dd>` : ''}</dl></div>
    <div class="panel"><h3>Feedback</h3>${p.reviews.length ? p.reviews.map(r => `<p><span class="pill ${r.positive ? 'ok' : 'bad'}">${r.positive ? 'Good' : 'Not good'}</span>
      ${esc(r.comment)} <span class="muted small">— <a href="#/profile/${r.rater.id}">${esc(r.rater.display_name)}</a>, ${ago(r.created_at)}</span></p>`).join('') : '<p class="muted">No feedback yet.</p>'}</div>
    ${S.me && !isMe(p.id) ? `<button class="linkbtn small" id="report-user" style="justify-self:start">Report this member</button>` : ''}
    ${S.me?.is_moderator && !isMe(p.id) ? `<button class="btn danger small" id="ban">${p.is_banned ? 'Lift suspension' : 'Suspend member'}</button>` : ''}
  </aside></div>`;
  const ru = $('#report-user'); if (ru) ru.onclick = () => report('user', p.id);
  const ban = $('#ban'); if (ban) ban.onclick = () => busy(ban, async () => {
    if (!confirm(p.is_banned ? 'Lift this suspension?' : 'Suspend this member? Their listings will be paused and open proposals cancelled.')) return;
    await rpc('mod_set_ban', { p_user: p.id, p_banned: !p.is_banned }); route();
  });
};

views.me = async () => {
  if (!S.me) {
    main.innerHTML = `<div class="panel" style="max-width:520px"><h1 style="font-size:2rem">Join ${esc(cfg.name)}</h1>
      ${S.api.mode === 'demo' ? `<p>This is the demo. Pick a sample member in the yellow bar above.</p>` : signInForm()}</div>`;
    bindSignIn(); return;
  }
  const me = S.me;
  const mine = await rpc('list_listings', { p_owner: me.id, p_limit: 100 });
  const span = Math.max(Math.abs(me.floor), Math.abs(me.balance), 10);
  const pct = Math.min(50, Math.abs(me.balance) / span * 50);
  main.innerHTML = `<h1>Your profile</h1>
  ${!me.agreed_rules ? `<p class="notice warn"><b>Welcome!</b> Choose a display name, add how people can reach you, and accept the community rules to start trading.</p>` : ''}
  <div class="detail">
    <form class="panel stack" id="pf">
      <label>Display name<span class="hint">Shown publicly. A first name and initial works well.</span><input type="text" name="display_name" required maxlength="40" value="${esc(me.display_name)}"></label>
      ${areaField('area', me.area)}
      <label>About you<textarea name="bio" maxlength="500">${esc(me.bio)}</textarea></label>
      <label>How to reach you<span class="hint">Private. Only shown to people once you've both agreed a trade.</span><input type="text" name="contact" maxlength="200" value="${esc(me.contact)}" placeholder="Phone, email or messaging handle"></label>
      ${me.agreed_rules ? `<p class="muted small" style="margin:0">You've accepted the <a href="#/rules">community rules</a>.</p>`
        : `<details open><summary><b>Community rules</b></summary><ul class="rules">${cfg.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
           <p>Not allowed: ${cfg.prohibited.map(esc).join('; ')}.</p></details>
           <label class="check"><input type="checkbox" name="agree" required><span>I've read the rules and agree to follow them.</span></label>`}
      <div class="row"><button class="btn primary">Save profile</button>
        <a class="btn" href="#/profile/${me.id}">See public profile</a>
        ${S.api.mode === 'live' ? `<button type="button" class="btn" id="signout">Sign out</button>` : ''}</div>
    </form>
    <aside class="side">
      <div class="panel"><h3>Your ${esc(cfg.creditName)}</h3>
        <p class="coin ${me.balance < 0 ? 'neg' : ''}" style="font-size:1.6rem;margin:0">${esc(me.balance)}</p>
        <div class="meter" aria-hidden="true"><i style="${me.balance >= 0 ? `left:50%;width:${pct}%` : `right:50%;width:${pct}%`}"></i><b></b></div>
        <p class="muted small">You can go down to ${esc(me.floor)}. ${me.completed < S.settings.established_after_trades
          ? `Your limit grows to −${S.settings.credit_limit} after ${S.settings.established_after_trades} completed trades.` : ''}
          Everyone's balances always add up to zero: ${esc(cfg.creditName)} are just a record of who has given more than they've received.</p>
        ${me.ledger.length ? `<table class="ledger"><tbody>${me.ledger.map(x => `<tr><td><a href="#/trade/${x.trade_id}">${esc(x.other)}</a><br><span class="muted small">${ago(x.created_at)}</span></td>
          <td class="num ${x.amount > 0 ? 'pos' : 'neg'}">${x.amount > 0 ? '+' : ''}${x.amount}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>
    </aside>
  </div>
  <section style="margin-top:36px"><div class="section-head"><h2>Your listings</h2><span class="row"><a class="btn small primary" href="#/new">New offer</a><a class="btn small want" href="#/new?kind=want">New want</a></span></div>
    ${mine.items.length ? `<div class="grid">${mine.items.map(tagCard).join('')}</div>` : `<p class="empty">You haven't posted anything yet.</p>`}</section>`;
  const f = $('#pf');
  f.onsubmit = e => {
    e.preventDefault();
    busy(f.querySelector('button.primary'), async () => {
      const o = form2obj(f);
      S.me = await rpc('update_profile', { p_display_name: o.display_name, p_area: o.area || '', p_bio: o.bio, p_contact: o.contact, p_agree_rules: !!o.agree });
      renderChrome(); toast('Profile saved'); route();
    });
  };
  const so = $('#signout'); if (so) so.onclick = async () => { await S.api.signOut(); location.hash = '#/'; };
};

views.rules = async () => {
  const s = S.settings;
  main.innerHTML = `<div style="max-width:720px">
    <h1>Community rules</h1>
    <ul class="rules">${cfg.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h2>Not allowed</h2><ul class="rules">${cfg.prohibited.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h2>How ${esc(cfg.creditName)} work</h2>
    <p>Everyone starts at zero. When you give something for ${esc(cfg.creditName)} your balance goes up, and when you receive something it goes down.
      Because every credit earned is a credit spent by someone else, all balances together always add up to zero. Nobody can buy them, and nobody issues them.</p>
    <p>New members can go down to −${s.new_member_credit_limit}. After ${s.established_after_trades} completed trades the limit becomes −${s.credit_limit}.
      ${s.max_balance != null ? `Balances can't go above ${s.max_balance}, so ${esc(cfg.creditName)} keep circulating.` : ''} ${esc(cfg.creditHint)}</p>
    <h2>Staying safe</h2>
    <ul class="rules"><li>Contact details are only shared once everyone in a trade has agreed.</li>
      <li>Meet in a public place, or with a friend, for first swaps. Don't share your home address until you're comfortable.</li>
      <li>Check feedback and completed trades on someone's profile.</li>
      <li>Only confirm a trade once you've received your part.</li>
      <li>Use “Report” on any listing, member or trade, or raise a dispute if a trade goes wrong.</li></ul>
    ${cfg.moderatorEmail ? `<p>Need a person? Email the moderators at <a href="mailto:${esc(cfg.moderatorEmail)}">${esc(cfg.moderatorEmail)}</a>.</p>` : ''}
    <h2>Tax</h2><p class="muted">Swapping between neighbours is usually informal, but if you trade as part of a business, bartered goods and services may count as income. Check the rules where you live.</p>
  </div>`;
};

views.mod = async () => {
  if (needMe('moderate')) return;
  const q = await rpc('mod_queue');
  const target = r => r.kind === 'listing' && r.target ? `<a href="#/listing/${r.target.id}">Listing: ${esc(r.target.title)}</a> by ${esc(r.target.owner.display_name)}`
    : r.kind === 'user' && r.target ? `<a href="#/profile/${r.target.id}">Member: ${esc(r.target.display_name)}</a>`
    : r.target ? `<a href="#/trade/${r.target.id}">Trade</a>` : 'Deleted item';
  main.innerHTML = `<h1>Moderation</h1>
    <section style="margin-bottom:32px"><h2>Disputes</h2>${q.disputes.length ? `<div class="stack">${q.disputes.map(t =>
      `<a class="panel trade-row" href="#/trade/${t.id}"><span><b>${esc(t.parties.map(p => p.user.display_name).join(', '))}</b><br><span class="muted small">${esc(t.dispute_reason)}</span></span><span class="pill bad">Open</span></a>`).join('')}</div>`
      : `<p class="empty">No disputes.</p>`}</section>
    <section><h2>Reports</h2>${q.reports.length ? `<div class="stack">${q.reports.map(r => `<div class="panel stack">
      <span>${target(r)}</span><span>“${esc(r.reason)}”</span>
      <span class="muted small">Reported by ${esc(r.reporter.display_name)}, ${ago(r.created_at)}</span>
      <div class="row">${r.kind === 'listing' && r.target ? `<button class="btn small danger" data-remove="${r.target.id}">Remove listing</button>` : ''}
        <button class="btn small" data-resolve="${r.id}">Mark as dealt with</button></div></div>`).join('')}</div>`
      : `<p class="empty">No open reports.</p>`}</section>`;
  main.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => busy(b, async () => {
    await rpc('mod_set_listing_status', { p_id: b.dataset.remove, p_status: 'removed' }); toast('Listing removed');
  }));
  main.querySelectorAll('[data-resolve]').forEach(b => b.onclick = () => busy(b, async () => {
    await rpc('mod_resolve_report', { p_id: Number(b.dataset.resolve), p_resolution: '' }); route();
  }));
};

// ----------------------------------------------------------------- router
async function route() {
  if (/^#(access_token|error)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/');
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const [name = 'home', ...params] = path.split('/').filter(Boolean);
  const view = views[name] || views.home;
  document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  try {
    await view(params, new URLSearchParams(qs || ''));
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="notice bad"><p><b>That didn't work.</b> ${esc(e.message)}</p><a class="btn" href="#/">Go to the home page</a></div>`;
  }
  if (route.moved) main.focus({ preventScroll: true });
  route.moved = true;
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------- boot
(async function boot() {
  try {
    S.api = await createBackend(cfg);
    S.settings = await rpc('get_settings');
    S.api.onAuthChange(async () => { await refreshMe(); route(); });
    await refreshMe();
    window.addEventListener('hashchange', route);
    route();
    // Keep the "needs your answer" badge fresh without reloading.
    const poll = () => { if (S.api.userId() && document.visibilityState === 'visible') refreshMe(); };
    setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="notice bad"><p><b>The site couldn't start.</b> ${esc(e.message)}</p>
      <p>If you run this site, check the Supabase URL and key in <code>config.js</code> and that <code>supabase/schema.sql</code> has been run.</p></div>`;
  }
})();
