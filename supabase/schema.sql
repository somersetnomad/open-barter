-- =====================================================================
--  Open Barter — database schema for Supabase
--
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is safe to run again after updates (it uses IF NOT EXISTS and
--  CREATE OR REPLACE throughout).
--
--  Security model: the website never touches tables directly. Every read
--  and write goes through the functions below, which check who is signed
--  in and enforce the community rules (credit limits, trade consent,
--  contact privacy, moderation). Row Level Security is switched on for
--  every table with no policies, so direct table access is refused.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Community settings (one row). Change these numbers to suit your group.
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                        int primary key default 1 check (id = 1),
  credit_limit              int  not null default 100, -- how far below zero an established member may go
  new_member_credit_limit   int  not null default 20,  -- how far below zero a new member may go
  established_after_trades  int  not null default 3,   -- completed trades before someone counts as established
  max_balance               int,                       -- optional ceiling on balances (null = no ceiling)
  public_balances           boolean not null default true, -- show balances on public profiles
  max_active_listings       int  not null default 30,
  new_member_max_listings   int  not null default 6,
  max_trade_parties         int  not null default 5,   -- largest trade loop allowed
  max_proposals_per_day     int  not null default 15,
  proposal_expiry_days      int  not null default 14
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null default 'New member' check (char_length(display_name) between 1 and 40),
  area             text not null default '' check (char_length(area) <= 60),
  bio              text not null default '' check (char_length(bio) <= 500),
  contact          text not null default '' check (char_length(contact) <= 200), -- private: only shown to trade partners
  agreed_rules_at  timestamptz,
  is_moderator     boolean not null default false,
  is_banned        boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.listings (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('offer', 'want')),
  category       text not null check (char_length(category) between 1 and 60),
  title          text not null check (char_length(title) between 3 and 80),
  description    text not null default '' check (char_length(description) <= 1000),
  tags           text[] not null default '{}',
  delivery       text not null default 'local' check (delivery in ('local', 'post', 'online')),
  area           text not null default '' check (char_length(area) <= 60),
  value_credits  int check (value_credits between 0 and 100000),
  is_service     boolean not null default false, -- services can be traded many times
  photo_url      text check (char_length(photo_url) <= 500),
  status         text not null default 'active' check (status in ('active', 'paused', 'traded', 'removed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists listings_status_kind on public.listings (status, kind, category);
create index if not exists listings_owner on public.listings (owner);

create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'proposed'
                  check (status in ('proposed', 'accepted', 'completed', 'cancelled', 'disputed')),
  note            text not null default '' check (char_length(note) <= 600),
  dispute_reason  text,
  cancelled_by    uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table if not exists public.trade_parties (
  trade_id      uuid not null references public.trades(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  accepted_at   timestamptz,
  confirmed_at  timestamptz,
  primary key (trade_id, user_id)
);
create index if not exists trade_parties_user on public.trade_parties (user_id);

-- Each leg is one thing moving from one person to another:
-- an offered listing, some credits, and/or a short description.
create table if not exists public.trade_legs (
  id          bigint generated always as identity primary key,
  trade_id    uuid not null references public.trades(id) on delete cascade,
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete set null,
  credits     int not null default 0 check (credits >= 0),
  note        text not null default '' check (char_length(note) <= 200),
  check (from_user <> to_user)
);
create index if not exists trade_legs_trade on public.trade_legs (trade_id);
create index if not exists trade_legs_listing on public.trade_legs (listing_id);

-- Mutual credit ledger. Credits are only ever created by a completed trade,
-- one person's +5 is always another person's −5, so the total is always zero.
create table if not exists public.ledger (
  id          bigint generated always as identity primary key,
  trade_id    uuid references public.trades(id) on delete set null,
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  amount      int not null check (amount > 0),
  created_at  timestamptz not null default now()
);
create index if not exists ledger_from on public.ledger (from_user);
create index if not exists ledger_to on public.ledger (to_user);

create table if not exists public.ratings (
  trade_id    uuid not null references public.trades(id) on delete cascade,
  rater       uuid not null references public.profiles(id) on delete cascade,
  ratee       uuid not null references public.profiles(id) on delete cascade,
  positive    boolean not null,
  comment     text not null default '' check (char_length(comment) <= 300),
  created_at  timestamptz not null default now(),
  primary key (trade_id, rater, ratee)
);
create index if not exists ratings_ratee on public.ratings (ratee);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  trade_id    uuid not null references public.trades(id) on delete cascade,
  sender      uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_trade on public.messages (trade_id);

create table if not exists public.reports (
  id           bigint generated always as identity primary key,
  reporter     uuid not null references public.profiles(id) on delete cascade,
  target_kind  text not null check (target_kind in ('listing', 'user', 'trade')),
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 3 and 1000),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  resolution   text,
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Lock every table: access only through the functions below.
alter table public.settings      enable row level security;
alter table public.profiles      enable row level security;
alter table public.listings      enable row level security;
alter table public.trades        enable row level security;
alter table public.trade_parties enable row level security;
alter table public.trade_legs    enable row level security;
alter table public.ledger        enable row level security;
alter table public.ratings       enable row level security;
alter table public.messages      enable row level security;
alter table public.reports       enable row level security;
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
--  New sign-ups get a profile automatically (named "Member xxxx" so the
--  email address is never shown publicly).
-- ---------------------------------------------------------------------
create or replace function public._on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, 'Member ' || substr(new.id::text, 1, 4))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public._on_new_user();

-- ---------------------------------------------------------------------
--  Internal helpers
-- ---------------------------------------------------------------------
create or replace function public._settings() returns public.settings
language sql stable security definer set search_path = public as $$
  select * from settings where id = 1
$$;

-- The signed-in user, or an error. Creates a missing profile and blocks banned users.
create or replace function public._me() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); p profiles;
begin
  if v is null then raise exception 'Please sign in first.'; end if;
  select * into p from profiles where id = v;
  if not found then
    insert into profiles (id, display_name) values (v, 'Member ' || substr(v::text, 1, 4));
  elsif p.is_banned then
    raise exception 'This account has been suspended by a moderator.';
  end if;
  return v;
end $$;

-- As _me(), but also requires the community rules to have been accepted.
create or replace function public._me_agreed() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := _me();
begin
  if (select agreed_rules_at from profiles where id = v) is null then
    raise exception 'Please read and accept the community rules on your profile page first.';
  end if;
  return v;
end $$;

create or replace function public._is_mod() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator and not is_banned from profiles where id = auth.uid()), false)
$$;

create or replace function public._balance(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(amount) from ledger where to_user = u), 0)
        - coalesce((select sum(amount) from ledger where from_user = u), 0))::int
$$;

create or replace function public._completed(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from trade_parties tp join trades t on t.id = tp.trade_id
  where tp.user_id = u and t.status = 'completed'
$$;

-- The lowest balance this person may reach (a negative number).
create or replace function public._floor(u uuid) returns int
language sql stable security definer set search_path = public as $$
  select -(case when _completed(u) >= s.established_after_trades
                then s.credit_limit else s.new_member_credit_limit end)
  from settings s where s.id = 1
$$;

-- Split text into lower-case keywords for matching (drops filler words, crude plural stripping).
create or replace function public._words(t text) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct case when char_length(w) > 3 and w like '%s' and w not like '%ss'
                                          then left(w, -1) else w end), '{}'::text[])
  from regexp_split_to_table(lower(coalesce(t, '')), '[^[:alnum:]]+') as w
  where char_length(w) >= 3
    and w <> all (array['the','and','for','with','any','some','old','new','used','need','needs','want',
                        'wanted','wanting','offer','offering','offers','free','good','can','will','help',
                        'from','your','you','our','looking','have','has','someone','please','etc','who',
                        'this','that','are','get','also','very','just','into','out','all'])
$$;

create or replace function public._mini_profile(u uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'area', p.area,
    'completed', _completed(p.id),
    'positive', (select count(*) from ratings r where r.ratee = p.id and r.positive),
    'negative', (select count(*) from ratings r where r.ratee = p.id and not r.positive),
    'is_banned', p.is_banned)
  from profiles p where p.id = u
$$;

create or replace function public._listing_json(l public.listings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id, 'kind', l.kind, 'category', l.category, 'title', l.title,
    'description', l.description, 'tags', to_jsonb(l.tags), 'delivery', l.delivery,
    'area', l.area, 'value_credits', l.value_credits, 'is_service', l.is_service,
    'photo_url', l.photo_url, 'status', l.status, 'created_at', l.created_at,
    'owner', _mini_profile(l.owner))
$$;

-- Raise an error if completing this trade would push anyone past a credit limit.
-- Pass p_user to check only one person (used when that person accepts).
create or replace function public._check_limits(p_trade uuid, p_user uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record; s settings := _settings(); v_new int; v_floor int;
begin
  for r in
    select u, sum(d)::int as delta from (
      select to_user as u, credits as d from trade_legs where trade_id = p_trade
      union all
      select from_user, -credits from trade_legs where trade_id = p_trade) x
    where p_user is null or u = p_user
    group by u
  loop
    v_new := _balance(r.u) + r.delta;
    v_floor := _floor(r.u);
    if r.delta < 0 and v_new < v_floor then
      raise exception '% would go past their credit limit (balance would be %, the limit is %).',
        (select display_name from profiles where id = r.u), v_new, v_floor;
    end if;
    if r.delta > 0 and s.max_balance is not null and v_new > s.max_balance then
      raise exception '% would go over the community''s maximum balance of %.',
        (select display_name from profiles where id = r.u), s.max_balance;
    end if;
  end loop;
end $$;

-- Proposals nobody finished answering expire after a while.
create or replace function public._expire_old() returns void
language sql security definer set search_path = public as $$
  update trades set status = 'cancelled', updated_at = now()
  where status = 'proposed'
    and created_at < now() - make_interval(days => (select proposal_expiry_days from settings where id = 1))
$$;

create or replace function public._trade_json(p_trade uuid, p_me uuid, p_detail boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t trades; res jsonb; v_open boolean;
begin
  select * into t from trades where id = p_trade;
  if not found then return null; end if;
  v_open := t.status in ('accepted', 'completed', 'disputed');

  res := jsonb_build_object(
    'id', t.id, 'status', t.status, 'note', t.note, 'created_at', t.created_at,
    'updated_at', t.updated_at, 'completed_at', t.completed_at, 'created_by', t.created_by,
    'dispute_reason', t.dispute_reason,
    'parties', (select coalesce(jsonb_agg(jsonb_build_object(
                    'user', _mini_profile(tp.user_id),
                    'accepted', tp.accepted_at is not null,
                    'confirmed', tp.confirmed_at is not null) order by tp.accepted_at nulls last), '[]')
                from trade_parties tp where tp.trade_id = t.id),
    'legs', (select coalesce(jsonb_agg(jsonb_build_object(
                  'from', g.from_user, 'from_name', pf.display_name,
                  'to', g.to_user, 'to_name', pt.display_name,
                  'credits', g.credits, 'note', g.note,
                  'listing', case when l.id is null then null else jsonb_build_object(
                     'id', l.id, 'title', l.title, 'is_service', l.is_service,
                     'value_credits', l.value_credits, 'photo_url', l.photo_url, 'status', l.status) end
               ) order by g.id), '[]')
             from trade_legs g
             join profiles pf on pf.id = g.from_user
             join profiles pt on pt.id = g.to_user
             left join listings l on l.id = g.listing_id
             where g.trade_id = t.id),
    'my_accepted', (select accepted_at is not null from trade_parties where trade_id = t.id and user_id = p_me),
    'my_confirmed', (select confirmed_at is not null from trade_parties where trade_id = t.id and user_id = p_me),
    'needs_action', (select (t.status = 'proposed' and accepted_at is null)
                         or (t.status = 'accepted' and confirmed_at is null)
                     from trade_parties where trade_id = t.id and user_id = p_me));

  if p_detail then
    res := res || jsonb_build_object(
      -- Contact details are only revealed once every party has agreed.
      'contacts', case when v_open then
          (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'display_name', p.display_name,
                                                       'contact', p.contact)), '[]')
           from trade_parties tp join profiles p on p.id = tp.user_id
           where tp.trade_id = t.id and tp.user_id <> p_me)
        else '[]'::jsonb end,
      'messages', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', m.id, 'sender', m.sender, 'sender_name', p.display_name,
                       'body', m.body, 'created_at', m.created_at) order by m.id), '[]')
                   from messages m join profiles p on p.id = m.sender where m.trade_id = t.id),
      'my_ratings', (select coalesce(jsonb_agg(jsonb_build_object('ratee', r.ratee, 'positive', r.positive,
                                                                 'comment', r.comment)), '[]')
                     from ratings r where r.trade_id = t.id and r.rater = p_me));
  end if;
  return res;
end $$;

-- Complete a trade: move credits, mark one-off items as traded.
create or replace function public._finalize(p_trade uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _check_limits(p_trade);
  if exists (select 1 from trade_legs g join listings l on l.id = g.listing_id
             where g.trade_id = p_trade and not l.is_service and l.status = 'traded') then
    raise exception 'An item in this trade has already been traded elsewhere. Cancel this trade or ask a moderator.';
  end if;

  insert into ledger (trade_id, from_user, to_user, amount)
  select p_trade, from_user, to_user, credits from trade_legs where trade_id = p_trade and credits > 0;

  update listings set status = 'traded', updated_at = now()
  where not is_service
    and id in (select listing_id from trade_legs where trade_id = p_trade and listing_id is not null);

  update trades set status = 'completed', completed_at = now(), updated_at = now() where id = p_trade;

  -- Unanswered proposals that relied on an item that has now gone are cancelled.
  update trades set status = 'cancelled', updated_at = now()
  where status = 'proposed' and id <> p_trade
    and id in (select g.trade_id from trade_legs g join listings l on l.id = g.listing_id
               where l.status = 'traded');
end $$;

-- ---------------------------------------------------------------------
--  Public API: community, profiles
-- ---------------------------------------------------------------------
create or replace function public.get_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'id' from settings s where id = 1
$$;

create or replace function public.community_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members', (select count(*) from profiles where not is_banned and agreed_rules_at is not null),
    'offers', (select count(*) from listings where status = 'active' and kind = 'offer'),
    'wants', (select count(*) from listings where status = 'active' and kind = 'want'),
    'completed_trades', (select count(*) from trades where status = 'completed'),
    'credits_circulating', (select coalesce(sum(b), 0) from
        (select _balance(id) as b from profiles) x where b > 0),
    'ledger_total', (select coalesce(sum(_balance(id)), 0) from profiles))
$$;

create or replace function public.get_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid; p profiles;
begin
  if auth.uid() is null then return null; end if;
  v := _me();
  perform _expire_old();
  select * into p from profiles where id = v;
  return jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'area', p.area, 'bio', p.bio,
    'contact', p.contact, 'agreed_rules', p.agreed_rules_at is not null,
    'is_moderator', p.is_moderator, 'joined', p.created_at,
    'balance', _balance(v), 'floor', _floor(v), 'completed', _completed(v),
    'needs_action', (select count(*) from trade_parties tp join trades t on t.id = tp.trade_id
                     where tp.user_id = v and ((t.status = 'proposed' and tp.accepted_at is null)
                                            or (t.status = 'accepted' and tp.confirmed_at is null))),
    'ledger', (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]') from (
                 select jsonb_build_object('trade_id', l.trade_id, 'created_at', l.created_at,
                    'amount', case when l.to_user = v then l.amount else -l.amount end,
                    'other', (select display_name from profiles where id =
                              case when l.to_user = v then l.from_user else l.to_user end)) as x
                 from ledger l where v in (l.from_user, l.to_user)
                 order by l.created_at desc limit 30) y));
end $$;

create or replace function public.update_profile(
  p_display_name text, p_area text default '', p_bio text default '',
  p_contact text default '', p_agree_rules boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _me();
begin
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then raise exception 'Please choose a display name.'; end if;
  update profiles set
    display_name = left(trim(p_display_name), 40),
    area = left(trim(coalesce(p_area, '')), 60),
    bio = left(coalesce(p_bio, ''), 500),
    contact = left(coalesce(p_contact, ''), 200),
    agreed_rules_at = case when p_agree_rules then coalesce(agreed_rules_at, now()) else agreed_rules_at end
  where id = v;
  return get_me();
end $$;

create or replace function public.get_profile(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p profiles; s settings := _settings();
begin
  select * into p from profiles where id = p_id;
  if not found then raise exception 'Member not found.'; end if;
  return _mini_profile(p.id) || jsonb_build_object(
    'bio', p.bio, 'joined', p.created_at, 'is_moderator', p.is_moderator,
    'balance', case when s.public_balances or p.id = auth.uid() then _balance(p.id) end,
    'listings', (select coalesce(jsonb_agg(_listing_json(l) order by l.created_at desc), '[]')
                 from listings l where l.owner = p.id and l.status = 'active'),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object(
                    'positive', r.positive, 'comment', r.comment, 'created_at', r.created_at,
                    'rater', jsonb_build_object('id', q.id, 'display_name', q.display_name))
                  order by r.created_at desc), '[]')
                from (select * from ratings where ratee = p.id order by created_at desc limit 30) r
                join profiles q on q.id = r.rater));
end $$;

-- ---------------------------------------------------------------------
--  Public API: listings
-- ---------------------------------------------------------------------
create or replace function public.list_listings(
  p_kind text default null, p_category text default null, p_q text default null,
  p_area text default null, p_delivery text default null, p_owner uuid default null,
  p_limit int default 60, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_mine boolean := p_owner is not null and p_owner = auth.uid(); res jsonb; v_total int;
begin
  with f as (
    select l.* from listings l join profiles p on p.id = l.owner
    where not p.is_banned
      and (case when v_mine then l.status <> 'removed' else l.status = 'active' end)
      and (p_kind is null or p_kind = '' or l.kind = p_kind)
      and (p_category is null or p_category = '' or l.category = p_category)
      and (p_area is null or p_area = '' or l.delivery <> 'local' or lower(l.area) = lower(p_area))
      and (p_delivery is null or p_delivery = '' or l.delivery = p_delivery)
      and (p_owner is null or l.owner = p_owner)
      and (p_q is null or p_q = '' or (l.title || ' ' || l.description || ' ' || array_to_string(l.tags, ' '))
             ilike '%' || p_q || '%')
  )
  select (select count(*) from f),
         (select coalesce(jsonb_agg(_listing_json(x) order by x.created_at desc), '[]') from
           (select * from f order by created_at desc
            limit least(greatest(coalesce(p_limit, 60), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x)
  into v_total, res;
  return jsonb_build_object('total', v_total, 'items', res);
end $$;

create or replace function public.get_listing(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l listings;
begin
  select * into l from listings where id = p_id;
  if not found or (l.status = 'removed' and l.owner is distinct from auth.uid() and not _is_mod()) then
    raise exception 'Listing not found.';
  end if;
  return _listing_json(l);
end $$;

create or replace function public.save_listing(
  p_id uuid default null, p_kind text default 'offer', p_category text default 'Other',
  p_title text default '', p_description text default '', p_tags text default '',
  p_delivery text default 'local', p_area text default '', p_value_credits int default null,
  p_is_service boolean default false, p_photo_url text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _me_agreed(); s settings := _settings(); l listings; v_tags text[]; v_max int;
begin
  if p_photo_url is not null and p_photo_url <> ''
     and p_photo_url not like 'https://%/storage/v1/object/public/listing-photos/%' then
    raise exception 'Photos must be uploaded through the site.';
  end if;
  v_tags := array(select distinct lower(trim(x)) from unnest(string_to_array(coalesce(p_tags, ''), ',')) x
                  where trim(x) <> '' limit 8);

  if p_id is null then
    v_max := case when _completed(v) >= s.established_after_trades
                  then s.max_active_listings else s.new_member_max_listings end;
    if (select count(*) from listings where owner = v and status in ('active', 'paused')) >= v_max then
      raise exception 'You have reached the limit of % listings. Remove or pause one first.', v_max;
    end if;
    insert into listings (owner, kind, category, title, description, tags, delivery, area,
                          value_credits, is_service, photo_url)
    values (v, p_kind, trim(p_category), trim(p_title), coalesce(p_description, ''), v_tags, p_delivery,
            trim(coalesce(p_area, '')), p_value_credits, coalesce(p_is_service, false), nullif(p_photo_url, ''))
    returning * into l;
  else
    update listings set kind = p_kind, category = trim(p_category), title = trim(p_title),
      description = coalesce(p_description, ''), tags = v_tags, delivery = p_delivery,
      area = trim(coalesce(p_area, '')), value_credits = p_value_credits,
      is_service = coalesce(p_is_service, false), photo_url = nullif(p_photo_url, ''), updated_at = now()
    where id = p_id and owner = v and status in ('active', 'paused')
    returning * into l;
    if not found then raise exception 'You can only edit your own active or paused listings.'; end if;
  end if;
  return _listing_json(l);
end $$;

create or replace function public.set_listing_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _me(); l listings;
begin
  if p_status not in ('active', 'paused', 'traded', 'removed') then raise exception 'Unknown status.'; end if;
  update listings set status = p_status, updated_at = now()
  where id = p_id and owner = v and status <> 'removed'
  returning * into l;
  if not found then raise exception 'You can only change your own listings.'; end if;
  return _listing_json(l);
end $$;

-- ---------------------------------------------------------------------
--  Matching: solves the "double coincidence of wants".
--  An edge A→B means "A offers something B wants" (same category,
--  shared keywords, and reachable: posted/online or same area).
--  We then look for loops that start and end with the caller:
--  2 people = a direct swap, 3+ people = a trade circle.
-- ---------------------------------------------------------------------
create or replace function public.find_matches(p_max_parties int default 4) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := _me();
  v_max int := least(greatest(coalesce(p_max_parties, 4), 2), (select max_trade_parties from settings where id = 1));
  res jsonb;
begin
  with recursive
  offers as (
    select l.id, l.owner, l.title, l.category, l.delivery, lower(trim(l.area)) as area, l.value_credits,
           _words(l.title || ' ' || l.description || ' ' || array_to_string(l.tags, ' ')) as words
    from listings l join profiles p on p.id = l.owner
    where l.kind = 'offer' and l.status = 'active' and not p.is_banned
  ),
  wants as (
    select l.id, l.owner, l.title, l.category, l.delivery, lower(trim(l.area)) as area,
           _words(l.title || ' ' || array_to_string(l.tags, ' ')) as words
    from listings l join profiles p on p.id = l.owner
    where l.kind = 'want' and l.status = 'active' and not p.is_banned
  ),
  pairs as (
    select o.owner as giver, w.owner as receiver, o.id as offer_id, o.title as offer_title,
           o.value_credits, w.id as want_id, w.title as want_title,
           (select count(*) from (select unnest(o.words) intersect select unnest(w.words)) z)::int as score
    from offers o join wants w on w.category = o.category and w.owner <> o.owner
    where o.delivery <> 'local' or o.area = '' or w.area = '' or o.area = w.area
  ),
  named as (
    select pr.*, pg.display_name as giver_name, pv.display_name as receiver_name
    from pairs pr join profiles pg on pg.id = pr.giver join profiles pv on pv.id = pr.receiver
    where pr.score > 0
  ),
  edges as (
    select distinct on (giver, receiver) * from named order by giver, receiver, score desc
  ),
  walk (path, legs, last, depth, total) as (
    select array[v_me, e.receiver],
           jsonb_build_array(jsonb_build_object('from', e.giver, 'from_name', e.giver_name, 'to', e.receiver,
             'to_name', e.receiver_name, 'listing_id', e.offer_id, 'offer_title', e.offer_title,
             'value_credits', e.value_credits, 'want_id', e.want_id, 'want_title', e.want_title)),
           e.receiver, 1, e.score
    from edges e where e.giver = v_me
    union all
    select w.path || e.receiver,
           w.legs || jsonb_build_array(jsonb_build_object('from', e.giver, 'from_name', e.giver_name, 'to', e.receiver,
             'to_name', e.receiver_name, 'listing_id', e.offer_id, 'offer_title', e.offer_title,
             'value_credits', e.value_credits, 'want_id', e.want_id, 'want_title', e.want_title)),
           e.receiver, w.depth + 1, w.total + e.score
    from walk w join edges e on e.giver = w.last
    where w.last <> v_me and w.depth < v_max
      and (e.receiver = v_me or not (e.receiver = any (w.path)))
  )
  select jsonb_build_object(
    'loops', (select coalesce(jsonb_agg(jsonb_build_object('size', depth, 'score', total, 'legs', legs)
                                        order by depth, total desc), '[]')
              from (select * from walk where last = v_me and depth >= 2 order by depth, total desc limit 25) x),
    'offers_for_my_wants', (select coalesce(jsonb_agg(jsonb_build_object(
                 'want_id', n.want_id, 'want_title', n.want_title, 'score', n.score,
                 'listing', _listing_json(l)) order by n.score desc), '[]')
              from (select * from named where receiver = v_me order by score desc limit 40) n
              join listings l on l.id = n.offer_id),
    'wants_for_my_offers', (select coalesce(jsonb_agg(jsonb_build_object(
                 'offer_id', n.offer_id, 'offer_title', n.offer_title, 'score', n.score,
                 'listing', _listing_json(l)) order by n.score desc), '[]')
              from (select * from named where giver = v_me order by score desc limit 40) n
              join listings l on l.id = n.want_id)
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------------
--  Public API: trades
--  Lifecycle: proposed → (everyone accepts) → accepted → (everyone
--  confirms it happened) → completed. Any party can cancel before anyone
--  confirms, or raise a dispute for a moderator.
-- ---------------------------------------------------------------------
create or replace function public.propose_trade(p_legs jsonb, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := _me_agreed();
  s settings := _settings();
  v_trade uuid;
  leg jsonb;
  v_from uuid; v_to uuid; v_listing uuid; v_credits int; v_note text;
  l listings;
  v_parties uuid[] := '{}';
begin
  if p_legs is null or jsonb_typeof(p_legs) <> 'array' or jsonb_array_length(p_legs) = 0 then
    raise exception 'A trade needs at least one part.';
  end if;
  if jsonb_array_length(p_legs) > 20 then raise exception 'That trade has too many parts.'; end if;
  if (select count(*) from trades where created_by = v_me and created_at > now() - interval '1 day')
       >= s.max_proposals_per_day then
    raise exception 'You have reached today''s limit of % new trade proposals.', s.max_proposals_per_day;
  end if;

  insert into trades (created_by, note) values (v_me, left(coalesce(p_note, ''), 600)) returning id into v_trade;

  for leg in select * from jsonb_array_elements(p_legs) loop
    v_from := nullif(leg->>'from', '')::uuid;
    v_to := nullif(leg->>'to', '')::uuid;
    v_listing := nullif(leg->>'listing_id', '')::uuid;
    v_credits := coalesce(nullif(leg->>'credits', '')::int, 0);
    v_note := left(trim(coalesce(leg->>'note', '')), 200);
    if v_from is null or v_to is null or v_from = v_to then
      raise exception 'Each part of a trade needs two different people.';
    end if;
    if v_credits < 0 then raise exception 'Credits cannot be negative.'; end if;
    if v_listing is null and v_credits = 0 and v_note = '' then
      raise exception 'Each part of a trade needs an item, some credits or a short description.';
    end if;
    if (select count(*) from profiles where id in (v_from, v_to) and not is_banned) < 2 then
      raise exception 'Everyone in a trade must be an active member.';
    end if;
    if v_listing is not null then
      select * into l from listings where id = v_listing;
      if not found or l.kind <> 'offer' or l.owner <> v_from or l.status <> 'active' then
        raise exception 'One of the items is not currently on offer from that person.';
      end if;
    end if;
    insert into trade_legs (trade_id, from_user, to_user, listing_id, credits, note)
    values (v_trade, v_from, v_to, v_listing, v_credits, v_note);
    v_parties := v_parties || v_from || v_to;
  end loop;

  select array_agg(distinct x) into v_parties from unnest(v_parties) x;
  if not (v_me = any (v_parties)) then raise exception 'You can only propose trades that include you.'; end if;
  if array_length(v_parties, 1) > s.max_trade_parties then
    raise exception 'Trades can include at most % people.', s.max_trade_parties;
  end if;

  insert into trade_parties (trade_id, user_id, accepted_at)
  select v_trade, x, case when x = v_me then now() end from unnest(v_parties) x;

  perform _check_limits(v_trade, v_me);
  return _trade_json(v_trade, v_me, true);
end $$;

create or replace function public.respond_trade(p_trade_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me_agreed(); t trades;
begin
  select * into t from trades where id = p_trade_id for update;
  if not found or not exists (select 1 from trade_parties where trade_id = t.id and user_id = v_me) then
    raise exception 'Trade not found.';
  end if;
  if t.status <> 'proposed' then raise exception 'This trade is no longer waiting for answers.'; end if;

  if not p_accept then
    update trades set status = 'cancelled', cancelled_by = v_me, updated_at = now() where id = t.id;
    return _trade_json(t.id, v_me, true);
  end if;

  perform _check_limits(t.id, v_me);
  if exists (select 1 from trade_legs g join listings l on l.id = g.listing_id
             where g.trade_id = t.id and (l.status <> 'active' or l.owner <> g.from_user)) then
    raise exception 'One of the items in this trade is no longer available.';
  end if;

  update trade_parties set accepted_at = coalesce(accepted_at, now()) where trade_id = t.id and user_id = v_me;
  if not exists (select 1 from trade_parties where trade_id = t.id and accepted_at is null) then
    update trades set status = 'accepted', updated_at = now() where id = t.id;
  end if;
  return _trade_json(t.id, v_me, true);
end $$;

create or replace function public.confirm_trade(p_trade_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me(); t trades;
begin
  select * into t from trades where id = p_trade_id for update;
  if not found or not exists (select 1 from trade_parties where trade_id = t.id and user_id = v_me) then
    raise exception 'Trade not found.';
  end if;
  if t.status <> 'accepted' then raise exception 'Only accepted trades can be confirmed.'; end if;

  update trade_parties set confirmed_at = coalesce(confirmed_at, now()) where trade_id = t.id and user_id = v_me;
  if not exists (select 1 from trade_parties where trade_id = t.id and confirmed_at is null) then
    perform _finalize(t.id);
  end if;
  return _trade_json(t.id, v_me, true);
end $$;

create or replace function public.cancel_trade(p_trade_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me(); t trades;
begin
  select * into t from trades where id = p_trade_id for update;
  if not found or not exists (select 1 from trade_parties where trade_id = t.id and user_id = v_me) then
    raise exception 'Trade not found.';
  end if;
  if t.status not in ('proposed', 'accepted') then raise exception 'This trade can no longer be cancelled.'; end if;
  if t.status = 'accepted' and exists (select 1 from trade_parties where trade_id = t.id and confirmed_at is not null) then
    raise exception 'Someone has already confirmed this trade happened. Raise a dispute instead so a moderator can help.';
  end if;
  update trades set status = 'cancelled', cancelled_by = v_me, updated_at = now() where id = t.id;
  return _trade_json(t.id, v_me, true);
end $$;

create or replace function public.dispute_trade(p_trade_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me(); t trades;
begin
  select * into t from trades where id = p_trade_id for update;
  if not found or not exists (select 1 from trade_parties where trade_id = t.id and user_id = v_me) then
    raise exception 'Trade not found.';
  end if;
  if t.status <> 'accepted' then raise exception 'Only accepted trades can be disputed.'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Please explain what went wrong (at least a sentence).';
  end if;
  update trades set status = 'disputed', updated_at = now(),
    dispute_reason = (select display_name from profiles where id = v_me) || ': ' || left(trim(p_reason), 1000)
  where id = t.id;
  return _trade_json(t.id, v_me, true);
end $$;

create or replace function public.my_trades() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me();
begin
  perform _expire_old();
  return (select coalesce(jsonb_agg(_trade_json(t.id, v_me) order by t.updated_at desc), '[]')
          from trades t join trade_parties tp on tp.trade_id = t.id and tp.user_id = v_me);
end $$;

create or replace function public.get_trade(p_trade_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me();
begin
  if not exists (select 1 from trade_parties where trade_id = p_trade_id and user_id = v_me) and not _is_mod() then
    raise exception 'Trade not found.';
  end if;
  return _trade_json(p_trade_id, v_me, true);
end $$;

create or replace function public.send_message(p_trade_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me(); t trades;
begin
  select * into t from trades where id = p_trade_id;
  if not found or (not exists (select 1 from trade_parties where trade_id = t.id and user_id = v_me) and not _is_mod()) then
    raise exception 'Trade not found.';
  end if;
  if t.status = 'cancelled' then raise exception 'This trade was cancelled.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Message is empty.'; end if;
  if (select count(*) from messages where trade_id = t.id and sender = v_me and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'You are sending messages too quickly. Please wait a little.';
  end if;
  insert into messages (trade_id, sender, body) values (t.id, v_me, left(trim(p_body), 1000));
  return _trade_json(t.id, v_me, true);
end $$;

create or replace function public.rate_trade(p_trade_id uuid, p_ratee uuid, p_positive boolean, p_comment text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me();
begin
  if (select status from trades where id = p_trade_id) is distinct from 'completed' then
    raise exception 'You can leave feedback once a trade is completed.';
  end if;
  if p_ratee = v_me
     or not exists (select 1 from trade_parties where trade_id = p_trade_id and user_id = v_me)
     or not exists (select 1 from trade_parties where trade_id = p_trade_id and user_id = p_ratee) then
    raise exception 'You can only leave feedback for other people in your trade.';
  end if;
  insert into ratings (trade_id, rater, ratee, positive, comment)
  values (p_trade_id, v_me, p_ratee, p_positive, left(coalesce(p_comment, ''), 300))
  on conflict (trade_id, rater, ratee) do update
    set positive = excluded.positive, comment = excluded.comment, created_at = now();
  return _trade_json(p_trade_id, v_me, true);
end $$;

-- ---------------------------------------------------------------------
--  Public API: safety and moderation
-- ---------------------------------------------------------------------
create or replace function public.report(p_kind text, p_target uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := _me();
begin
  if p_kind not in ('listing', 'user', 'trade') then raise exception 'Unknown report type.'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Please say what the problem is.'; end if;
  if (select count(*) from reports where reporter = v_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have sent a lot of reports today. A moderator will look at them soon.';
  end if;
  insert into reports (reporter, target_kind, target_id, reason) values (v_me, p_kind, p_target, left(trim(p_reason), 1000));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public._require_mod() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid := _me();
begin
  if not _is_mod() then raise exception 'Moderators only.'; end if;
  return v;
end $$;

create or replace function public.mod_queue() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _require_mod();
begin
  return jsonb_build_object(
    'reports', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'kind', r.target_kind, 'target_id', r.target_id, 'reason', r.reason,
                  'created_at', r.created_at, 'reporter', _mini_profile(r.reporter),
                  'target', case r.target_kind
                     when 'listing' then (select _listing_json(l) from listings l where l.id = r.target_id)
                     when 'user' then _mini_profile(r.target_id)
                     else _trade_json(r.target_id, v) end) order by r.created_at), '[]')
                from reports r where r.status = 'open'),
    'disputes', (select coalesce(jsonb_agg(_trade_json(t.id, v, true) order by t.updated_at), '[]')
                 from trades t where t.status = 'disputed'));
end $$;

create or replace function public.mod_resolve_report(p_id bigint, p_resolution text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _require_mod();
begin
  update reports set status = 'resolved', resolution = left(coalesce(p_resolution, ''), 500), resolved_by = v
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mod_set_listing_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _require_mod(); l listings;
begin
  if p_status not in ('active', 'paused', 'removed') then raise exception 'Unknown status.'; end if;
  update listings set status = p_status, updated_at = now() where id = p_id returning * into l;
  if not found then raise exception 'Listing not found.'; end if;
  return _listing_json(l);
end $$;

create or replace function public.mod_set_ban(p_user uuid, p_banned boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _require_mod();
begin
  if p_user = v then raise exception 'You cannot ban yourself.'; end if;
  update profiles set is_banned = p_banned where id = p_user;
  if p_banned then
    update listings set status = 'paused', updated_at = now() where owner = p_user and status = 'active';
    update trades set status = 'cancelled', updated_at = now()
    where status = 'proposed' and id in (select trade_id from trade_parties where user_id = p_user);
  end if;
  return _mini_profile(p_user);
end $$;

create or replace function public.mod_resolve_dispute(p_trade_id uuid, p_outcome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := _require_mod();
begin
  if (select status from trades where id = p_trade_id) is distinct from 'disputed' then
    raise exception 'That trade is not in dispute.';
  end if;
  if p_outcome = 'complete' then
    update trade_parties set confirmed_at = coalesce(confirmed_at, now()) where trade_id = p_trade_id;
    perform _finalize(p_trade_id);
  elsif p_outcome = 'cancel' then
    update trades set status = 'cancelled', cancelled_by = v, updated_at = now() where id = p_trade_id;
  else
    raise exception 'Outcome must be complete or cancel.';
  end if;
  return _trade_json(p_trade_id, v, true);
end $$;

-- ---------------------------------------------------------------------
--  Permissions: only the public API functions can be called from the site.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.get_settings(), public.community_stats(), public.get_me(), public.get_profile(uuid),
  public.list_listings(text, text, text, text, text, uuid, int, int), public.get_listing(uuid)
to anon, authenticated;

grant execute on function
  public.update_profile(text, text, text, text, boolean),
  public.save_listing(uuid, text, text, text, text, text, text, text, int, boolean, text),
  public.set_listing_status(uuid, text),
  public.find_matches(int),
  public.propose_trade(jsonb, text), public.respond_trade(uuid, boolean),
  public.confirm_trade(uuid), public.cancel_trade(uuid), public.dispute_trade(uuid, text),
  public.my_trades(), public.get_trade(uuid), public.send_message(uuid, text),
  public.rate_trade(uuid, uuid, boolean, text), public.report(text, uuid, text),
  public.mod_queue(), public.mod_resolve_report(bigint, text), public.mod_set_listing_status(uuid, text),
  public.mod_set_ban(uuid, boolean), public.mod_resolve_dispute(uuid, text)
to authenticated;

-- Supabase grants new functions to everyone by default; stop that for this schema.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
