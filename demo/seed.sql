-- Demo mode only: sample members, listings and history.
-- Alice, Bob and Chidi form a three-way trade circle; Dana and Eve can swap directly.
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'alice@example.org'),
  ('00000000-0000-4000-a000-00000000000b', 'bob@example.org'),
  ('00000000-0000-4000-a000-00000000000c', 'chidi@example.org'),
  ('00000000-0000-4000-a000-00000000000d', 'dana@example.org'),
  ('00000000-0000-4000-a000-00000000000e', 'eve@example.org'),
  ('00000000-0000-4000-a000-00000000000f', 'farah@example.org'),
  ('00000000-0000-4000-a000-000000000010', 'george@example.org');

update public.profiles p set display_name = v.name, area = v.area, bio = v.bio, contact = v.contact,
  agreed_rules_at = now() - interval '30 days', created_at = now() - interval '60 days',
  is_moderator = v.moderator
from (values
  ('00000000-0000-4000-a000-00000000000a'::uuid, 'Alice R.', 'Riverside', 'Home baker. Happy to swap loaves for help around the house.', 'alice@example.org · 07700 900001', true),
  ('00000000-0000-4000-a000-00000000000b'::uuid, 'Bob T.', 'Riverside', 'Fix bikes in my garage at weekends.', 'Text 07700 900002', false),
  ('00000000-0000-4000-a000-00000000000c'::uuid, 'Chidi O.', 'Riverside', 'Music teacher, 15 years playing guitar.', 'chidi@example.org', false),
  ('00000000-0000-4000-a000-00000000000d'::uuid, 'Dana K.', 'Old Town', 'Two kids, lots of outgrown clothes.', 'dana@example.org', false),
  ('00000000-0000-4000-a000-00000000000e'::uuid, 'Eve M.', 'Old Town', 'Keen gardener with too much free time.', 'Signal: 07700 900005', false),
  ('00000000-0000-4000-a000-00000000000f'::uuid, 'Farah S.', 'Hillside', 'Data analyst, can teach spreadsheets and Python.', 'farah@example.org', false),
  ('00000000-0000-4000-a000-000000000010'::uuid, 'George P.', 'Hillside', 'Retired carpenter with a shed full of tools.', 'Phone 07700 900007', false)
) as v(id, name, area, bio, contact, moderator)
where p.id = v.id;

insert into public.listings (id, owner, kind, category, title, description, tags, delivery, area, value_credits, is_service, created_at) values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', 'offer', 'Food & drink', 'Fresh sourdough loaves', 'Baked every Saturday morning. Large white or wholemeal sourdough.', '{bread,baking}', 'local', 'Riverside', 4, true, now() - interval '9 days'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000a', 'want', 'Repairs & DIY', 'Bike repair', 'My bike''s gears slip and the brakes squeal.', '{bike,bicycle}', 'local', 'Riverside', null, false, now() - interval '8 days'),
  ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000000a', 'offer', 'Food & drink', 'Homemade plum jam', 'Jars from this year''s plums. Small batch.', '{jam,preserves}', 'local', 'Riverside', 3, true, now() - interval '20 days'),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-00000000000b', 'offer', 'Repairs & DIY', 'Bike repair and tune-ups', 'Gears, brakes, punctures, chains. Bring it round on a Saturday.', '{bike,bicycle,cycling}', 'local', 'Riverside', 10, true, now() - interval '7 days'),
  ('10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-00000000000b', 'want', 'Lessons & tutoring', 'Guitar lessons for a beginner', 'Never played. Have an acoustic guitar.', '{guitar,music}', 'online', '', null, false, now() - interval '7 days'),
  ('10000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-00000000000c', 'offer', 'Lessons & tutoring', 'Beginner guitar lessons', 'One-hour lessons by video call or in person. Chords, strumming, first songs.', '{guitar,music,lessons}', 'online', 'Riverside', 8, true, now() - interval '6 days'),
  ('10000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-00000000000c', 'want', 'Food & drink', 'Sourdough bread', 'Would love a weekly loaf.', '{bread}', 'local', 'Riverside', null, false, now() - interval '5 days'),
  ('10000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-00000000000d', 'offer', 'Kids & baby', 'Children''s clothes, 2–4 years', 'Bag of about 20 items, good condition. Mixed.', '{clothes,kids}', 'post', 'Old Town', 6, false, now() - interval '4 days'),
  ('10000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-00000000000d', 'want', 'Home & garden', 'Help with garden weeding', 'Small back garden has got away from me.', '{garden,weeding}', 'local', 'Old Town', null, false, now() - interval '4 days'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000e', 'offer', 'Home & garden', 'Garden help: weeding, mowing, pruning', 'Two-hour sessions. I bring my own gloves and tools.', '{garden,weeding,mowing}', 'local', 'Old Town', 8, true, now() - interval '3 days'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000e', 'want', 'Kids & baby', 'Kids clothes for a 3 year old', 'For my nephew.', '{clothes,kids}', 'post', 'Old Town', null, false, now() - interval '3 days'),
  ('10000000-0000-4000-a000-00000000000c', '00000000-0000-4000-a000-00000000000f', 'offer', 'Tech help', 'Spreadsheet and Python tutoring', 'Excel, Google Sheets, beginner Python. Online, one hour.', '{excel,python,spreadsheets}', 'online', 'Hillside', 6, true, now() - interval '12 days'),
  ('10000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-00000000000f', 'want', 'Transport & lifts', 'Lift to the station on Monday mornings', 'Around 7:30am, Hillside to the main station.', '{lift,car}', 'local', 'Hillside', null, false, now() - interval '2 days'),
  ('10000000-0000-4000-a000-00000000000e', '00000000-0000-4000-a000-000000000010', 'offer', 'Tools & equipment', 'Cordless drill to lend', 'Drill and a set of bits, lend for up to a week.', '{drill,tools}', 'local', 'Hillside', 2, true, now() - interval '15 days'),
  ('10000000-0000-4000-a000-00000000000f', '00000000-0000-4000-a000-000000000010', 'want', 'Furniture', 'Small bookshelf', 'Anything up to a metre wide.', '{shelf,bookcase}', 'local', 'Hillside', null, false, now() - interval '1 day'),
  ('10000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000010', 'offer', 'Repairs & DIY', 'Small woodwork repairs', 'Wobbly chairs, sticking drawers, loose hinges.', '{woodwork,furniture,repairs}', 'local', 'Hillside', 6, true, now() - interval '10 days'),
  ('10000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-00000000000d', 'offer', 'Books & media', 'Box of paperback novels', 'About 30 novels, mostly crime and thrillers.', '{books,novels}', 'local', 'Old Town', 5, false, now() - interval '6 hours');

-- History: two completed trades so balances and reviews are not empty.
insert into public.trades (id, created_by, status, note, created_at, updated_at, completed_at) values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010', 'completed', 'Python lesson for my grandson', now() - interval '11 days', now() - interval '10 days', now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000d', 'completed', '', now() - interval '18 days', now() - interval '17 days', now() - interval '17 days');
insert into public.trade_parties (trade_id, user_id, accepted_at, confirmed_at) values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010', now() - interval '11 days', now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000f', now() - interval '11 days', now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000d', now() - interval '18 days', now() - interval '17 days'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000a', now() - interval '18 days', now() - interval '17 days');
insert into public.trade_legs (trade_id, from_user, to_user, listing_id, credits, note) values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000f', '00000000-0000-4000-a000-000000000010', '10000000-0000-4000-a000-00000000000c', 0, ''),
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-00000000000f', null, 6, ''),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000d', '10000000-0000-4000-a000-000000000003', 0, '2 jars'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-00000000000a', null, 6, '');
insert into public.ledger (trade_id, from_user, to_user, amount, created_at) values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-00000000000f', 6, now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-00000000000a', 6, now() - interval '17 days');
insert into public.ratings (trade_id, rater, ratee, positive, comment, created_at) values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-00000000000f', true, 'Patient and clear. My grandson loved it.', now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000f', '00000000-0000-4000-a000-000000000010', true, 'Credits arrived straight away, lovely chap.', now() - interval '10 days'),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-00000000000a', true, 'Best jam I have had in years.', now() - interval '17 days');

-- A pending proposal waiting for Alice: George offers credits for a loaf.
insert into public.trades (id, created_by, status, note, created_at, updated_at) values
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000010', 'proposed', 'Could I get a wholemeal loaf this Saturday?', now() - interval '3 hours', now() - interval '3 hours');
insert into public.trade_parties (trade_id, user_id, accepted_at) values
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000010', now() - interval '3 hours'),
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000000a', null);
insert into public.trade_legs (trade_id, from_user, to_user, listing_id, credits, note) values
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-000000000010', '10000000-0000-4000-a000-000000000001', 0, 'One wholemeal loaf'),
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-00000000000a', null, 4, '');
