import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const db = new PGlite();
await db.exec(fs.readFileSync(`${root}/demo/shim.sql`, 'utf8'));
await db.exec(fs.readFileSync(`${root}/supabase/schema.sql`, 'utf8'));
await db.exec(fs.readFileSync(`${root}/demo/seed.sql`, 'utf8'));
console.log('schema + seed loaded');

const U = { alice: '00000000-0000-4000-a000-00000000000a', bob: '00000000-0000-4000-a000-00000000000b',
  chidi: '00000000-0000-4000-a000-00000000000c', dana: '00000000-0000-4000-a000-00000000000d',
  eve: '00000000-0000-4000-a000-00000000000e', farah: '00000000-0000-4000-a000-00000000000f',
  george: '00000000-0000-4000-a000-000000000010' };

async function call(uid, fn, args = {}) {
  await db.query(`select set_config('demo.uid', $1, false)`, [uid || '']);
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
  const vals = keys.map(k => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
  const res = await db.query(sql, vals);
  return res.rows[0].r;
}
async function fails(p, re) {
  try { await p; } catch (e) { assert.match(e.message, re); return e.message; }
  throw new Error('expected failure ' + re);
}

// Anonymous browsing
const stats = await call(null, 'community_stats');
console.log('stats', stats);
assert.equal(Number(stats.ledger_total), 0);
const all = await call(null, 'list_listings', {});
assert.equal(all.total, 17);
assert.equal(await call(null, 'get_me'), null);
await fails(call(null, 'find_matches'), /sign in/);
const search = await call(null, 'list_listings', { p_q: 'guitar', p_kind: 'offer' });
assert.equal(search.total, 1);

// Matching: Alice should see the 3-way loop Alice→Chidi→Bob→Alice
const m = await call(U.alice, 'find_matches', {});
console.log('alice loops', m.loops.map(l => l.legs.map(g => `${g.from_name}→${g.to_name}: ${g.offer_title}`).join(' | ')));
const loop = m.loops.find(l => l.size === 3);
assert.ok(loop, 'three-way loop found');
console.log('offers for alice wants', m.offers_for_my_wants.map(x => x.listing.title));
const de = await call(U.dana, 'find_matches', {});
assert.ok(de.loops.some(l => l.size === 2), 'Dana-Eve direct swap');

// Propose the loop
const legs = loop.legs.map(g => ({ from: g.from, to: g.to, listing_id: g.listing_id }));
let t = await call(U.alice, 'propose_trade', { p_legs: legs, p_note: 'Circle!' });
assert.equal(t.status, 'proposed');
assert.equal(t.parties.length, 3);
assert.deepEqual(t.contacts, [], 'no contacts before acceptance');
await fails(call(U.dana, 'get_trade', { p_trade_id: t.id }), /not found/);
t = await call(U.bob, 'respond_trade', { p_trade_id: t.id, p_accept: true });
assert.equal(t.status, 'proposed');
t = await call(U.chidi, 'respond_trade', { p_trade_id: t.id, p_accept: true });
assert.equal(t.status, 'accepted');
assert.equal(t.contacts.length, 2, 'contacts revealed after all accept');
t = await call(U.chidi, 'send_message', { p_trade_id: t.id, p_body: 'Saturday 10am?' });
assert.equal(t.messages.length, 1);
await fails(call(U.alice, 'rate_trade', { p_trade_id: t.id, p_ratee: U.bob, p_positive: true }), /completed/);
for (const u of [U.alice, U.bob]) t = await call(u, 'confirm_trade', { p_trade_id: t.id });
await fails(call(U.chidi, 'cancel_trade', { p_trade_id: t.id }), /dispute/);
t = await call(U.chidi, 'confirm_trade', { p_trade_id: t.id });
assert.equal(t.status, 'completed');
t = await call(U.alice, 'rate_trade', { p_trade_id: t.id, p_ratee: U.bob, p_positive: true, p_comment: 'Great fix' });
assert.equal(t.my_ratings.length, 1);
const bobProfile = await call(null, 'get_profile', { p_id: U.bob });
assert.equal(bobProfile.positive, 1);
console.log('loop trade completed');

// Credits: new member limit (20). Bob has 1 completed trade -> new member, floor -20.
await fails(call(U.bob, 'propose_trade', { p_legs: [{ from: U.bob, to: U.eve, credits: 25 }] }), /credit limit/);
let c = await call(U.bob, 'propose_trade', { p_legs: [
  { from: U.eve, to: U.bob, listing_id: '10000000-0000-4000-a000-00000000000a' },
  { from: U.bob, to: U.eve, credits: 8 }] });
c = await call(U.eve, 'respond_trade', { p_trade_id: c.id, p_accept: true });
for (const u of [U.bob, U.eve]) c = await call(u, 'confirm_trade', { p_trade_id: c.id });
assert.equal(c.status, 'completed');
const bobMe = await call(U.bob, 'get_me');
assert.equal(bobMe.balance, -8);
const eveMe = await call(U.eve, 'get_me');
assert.equal(eveMe.balance, 8);
assert.equal(Number((await call(null, 'community_stats')).ledger_total), 0, 'mutual credit sums to zero');
console.log('credit trade ok, bob', bobMe.balance, 'floor', bobMe.floor);

// One-off item: Dana's clothes traded once; a second proposal on it gets auto-cancelled.
const p1 = await call(U.eve, 'propose_trade', { p_legs: [
  { from: U.dana, to: U.eve, listing_id: '10000000-0000-4000-a000-000000000008' },
  { from: U.eve, to: U.dana, listing_id: '10000000-0000-4000-a000-00000000000a' }] });
const p2 = await call(U.george, 'propose_trade', { p_legs: [
  { from: U.dana, to: U.george, listing_id: '10000000-0000-4000-a000-000000000008' },
  { from: U.george, to: U.dana, credits: 6 }] });
await call(U.dana, 'respond_trade', { p_trade_id: p1.id, p_accept: true });
await call(U.dana, 'confirm_trade', { p_trade_id: p1.id });
const done = await call(U.eve, 'confirm_trade', { p_trade_id: p1.id });
assert.equal(done.status, 'completed');
const p2after = await call(U.george, 'get_trade', { p_trade_id: p2.id });
assert.equal(p2after.status, 'cancelled', 'competing proposal auto-cancelled');
const clothes = await call(null, 'list_listings', { p_q: 'children' });
assert.equal(clothes.total, 0, 'traded item hidden');
console.log('one-off item handling ok');

// Disputes and moderation
let d = await call(U.george, 'propose_trade', { p_legs: [
  { from: U.alice, to: U.george, listing_id: '10000000-0000-4000-a000-000000000003' },
  { from: U.george, to: U.alice, credits: 3 }] });
d = await call(U.alice, 'respond_trade', { p_trade_id: d.id, p_accept: true });
await call(U.alice, 'confirm_trade', { p_trade_id: d.id });
await fails(call(U.george, 'dispute_trade', { p_trade_id: d.id, p_reason: 'no' }), /explain/);
d = await call(U.george, 'dispute_trade', { p_trade_id: d.id, p_reason: 'The jar never arrived at my door.' });
assert.equal(d.status, 'disputed');
await call(U.george, 'report', { p_kind: 'listing', p_target: '10000000-0000-4000-a000-000000000003', p_reason: 'Testing reports' });
await fails(call(U.bob, 'mod_queue'), /Moderators/);
const q = await call(U.alice, 'mod_queue');
assert.equal(q.disputes.length, 1); assert.equal(q.reports.length, 1);
d = await call(U.alice, 'mod_resolve_dispute', { p_trade_id: d.id, p_outcome: 'cancel' });
assert.equal(d.status, 'cancelled');
await call(U.alice, 'mod_set_ban', { p_user: U.farah, p_banned: true });
await fails(call(U.farah, 'get_me'), /suspended/);
assert.equal((await call(null, 'list_listings', { p_q: 'python' })).total, 0, 'banned user listings hidden');
console.log('moderation ok');

// Listings: rules acceptance, limits, ownership
await db.query(`insert into auth.users (id, email) values ('00000000-0000-4000-a000-0000000000aa', 'new@example.org')`);
const NEW = '00000000-0000-4000-a000-0000000000aa';
const me = await call(NEW, 'get_me');
assert.match(me.display_name, /^Member /);
await fails(call(NEW, 'save_listing', { p_kind: 'offer', p_category: 'Other', p_title: 'Thing' }), /rules/);
await call(NEW, 'update_profile', { p_display_name: 'Newbie', p_area: 'Riverside', p_contact: 'x', p_agree_rules: true });
for (let i = 0; i < 6; i++) await call(NEW, 'save_listing', { p_kind: 'offer', p_category: 'Other', p_title: 'Thing ' + i, p_tags: 'a, B ,c' });
await fails(call(NEW, 'save_listing', { p_kind: 'offer', p_category: 'Other', p_title: 'Too many' }), /limit/);
await fails(call(NEW, 'set_listing_status', { p_id: '10000000-0000-4000-a000-000000000001', p_status: 'removed' }), /own/);
await fails(call(NEW, 'save_listing', { p_kind: 'offer', p_category: 'Other', p_title: 'Pic', p_photo_url: 'https://evil.example/x.jpg' }), /Photos/);
const mine = await call(NEW, 'list_listings', { p_owner: NEW });
assert.equal(mine.total, 6);
assert.deepEqual(mine.items[0].tags.sort(), ['a', 'b', 'c']);
// Can't put someone else's item in a trade as if it were yours
await fails(call(NEW, 'propose_trade', { p_legs: [{ from: NEW, to: U.bob, listing_id: '10000000-0000-4000-a000-000000000001' }] }), /not currently on offer/);
// Can't propose a trade you're not in
await fails(call(NEW, 'propose_trade', { p_legs: [{ from: U.alice, to: U.bob, credits: 1 }] }), /include you/);
const mt = await call(U.alice, 'my_trades');
assert.ok(mt.some(x => x.needs_action), 'Alice has the seeded pending proposal');
console.log('ALL TESTS PASSED');
