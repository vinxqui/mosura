-- =====================================================================
--  FITBOOK / GTG Fitness : Supabase database
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run again: it drops and recreates only its own objects
--  (it does NOT delete saved records or user accounts).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. User profiles (one per login). Role decides what each user can do.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  role        text not null default 'member'
              check (role in ('member','trainer','admin','owner')),
  created_at  timestamptz not null default now()
);

-- Create a profile automatically whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'first_name', ''),
          coalesce(new.raw_user_meta_data->>'last_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role level of the person making the request (guest when not logged in).
create or replace function public.app_level(p_role text)
returns int language sql immutable as $$
  select case p_role when 'owner' then 4 when 'admin' then 3
                     when 'trainer' then 2 when 'member' then 1 else 0 end
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'guest')
$$;

-- ---------------------------------------------------------------------
-- 2. App data. Every list the website keeps (trainers, classes, payments,
--    enrollments, equipment, feedback ...) is a "collection"; every item in
--    it is one row in app_records.
-- ---------------------------------------------------------------------
create table if not exists public.app_collections (
  name        text primary key,
  shape       text not null check (shape in ('array','object','value')),
  updated_at  timestamptz not null default now()
);

create table if not exists public.app_records (
  collection  text   not null references public.app_collections(name) on delete cascade,
  id          text   not null,
  data        jsonb,
  sort_order  int    not null default 0,
  client_ts   bigint not null default 0,      -- when the browser made the change (ms)
  created_by  uuid   default auth.uid(),       -- who first saved this item
  updated_by  uuid   default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);
alter table public.app_records add column if not exists created_by uuid default auth.uid();
update public.app_records set created_by = updated_by where created_by is null;
create index if not exists app_records_collection_idx on public.app_records(collection, sort_order);

-- Who may read / change each collection (minimum role).
-- Collections not listed here: members can read, trainers and up can change.
-- Change these rows any time to tighten or loosen access.
-- own_only: a member sees and changes only the items they created themselves
-- (staff see everything).
create table if not exists public.app_collection_rules (
  name       text primary key,
  read_min   text not null default 'member',
  write_min  text not null default 'trainer',
  own_only   boolean not null default false
);
alter table public.app_collection_rules add column if not exists own_only boolean not null default false;

insert into public.app_collection_rules (name, read_min, write_min) values
  ('gtg_classes',             'guest',   'admin'),
  ('gtg_class_options',       'guest',   'admin'),
  ('gtg_trainers',            'guest',   'admin'),
  ('gtg_equipment',           'guest',   'admin'),
  ('gtg_announcements',       'guest',   'trainer'),
  ('gtg_calendar_events',     'guest',   'trainer'),
  ('gtg_trainer_shifts',      'guest',   'trainer'),
  ('gtg_trainer_daysoff',     'guest',   'trainer'),
  ('gtg_trainer_absences',    'guest',   'trainer'),
  ('gtg_class_members',       'member',  'trainer'),
  ('gtg_payments',            'member',  'member'),   -- members add; only staff can verify (see app_sync)
  ('gtg_enrollments',         'member',  'member'),
  ('gtg_feedback',            'member',  'member'),
  ('gtg_member_measurements', 'member',  'member'),
  ('gtg_member_progress',     'member',  'trainer'),
  ('gtg_member_notes',        'trainer', 'trainer'),
  ('gtg_employees',           'admin',   'admin'),
  ('gtg_audit_v1',            'admin',   'member')    -- every login/logout is logged
on conflict (name) do nothing;

-- Members only see their own payments, enrollments and measurements.
update public.app_collection_rules set own_only = true
 where name in ('gtg_payments', 'gtg_enrollments', 'gtg_member_measurements');
-- Members fill in their own measurements (earlier versions of this file had trainer).
update public.app_collection_rules set write_min = 'member' where name = 'gtg_member_measurements';

-- Collections whose name ends in "@<user id>" belong to that one user
-- (used for each person's own profile page data).
create or replace function public.app_can(p_collection text, p_write boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  r     text := public.my_role();
  lvl   int  := public.app_level(public.my_role());
  owner_id text;
  rule  record;
begin
  if position('@' in p_collection) > 0 then
    owner_id := split_part(p_collection, '@', 2);
    if auth.uid() is not null and owner_id = auth.uid()::text then return true; end if;
    return (not p_write) and lvl >= 3;            -- admin / owner may look, not change
  end if;
  select * into rule from public.app_collection_rules where name = p_collection;
  if not found then
    return lvl >= case when p_write then 2 else 1 end;
  end if;
  return lvl >= public.app_level(case when p_write then rule.write_min else rule.read_min end);
end $$;

-- May the current user see this one item?
create or replace function public.app_row_visible(p_collection text, p_created_by uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_level(public.my_role()) >= 2
      or not coalesce((select own_only from public.app_collection_rules where name = p_collection), false)
      or (auth.uid() is not null and p_created_by = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- 3. Read everything this user may see, in one call.
-- ---------------------------------------------------------------------
create or replace function public.app_dump()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  select coalesce(jsonb_object_agg(c.name, jsonb_build_object(
           'shape', c.shape,
           'rows', coalesce((select jsonb_agg(jsonb_build_array(r.id, r.data) order by r.sort_order, r.id)
                             from public.app_records r where r.collection = c.name
                              and public.app_row_visible(r.collection, r.created_by)), '[]'::jsonb))), '{}'::jsonb)
    into result
    from public.app_collections c
   where public.app_can(c.name, false);
  return jsonb_build_object('role', public.my_role(), 'collections', result);
end $$;

-- ---------------------------------------------------------------------
-- 4. Save changes from the website.
--    p_upserts: [{ "id": "...", "data": {...}, "sort_order": 0 }, ...]
--    p_deletes: ids removed from the list
--    p_replace: true when the whole collection is being rewritten
-- ---------------------------------------------------------------------
create or replace function public.app_sync(
  p_collection text, p_shape text, p_upserts jsonb, p_deletes text[],
  p_replace boolean, p_ts bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lvl int := public.app_level(public.my_role());
  u jsonb;
  old_status text;
  n_up int := 0;
  n_del int := 0;
begin
  if auth.uid() is null then
    raise exception 'Please log in first' using errcode = '42501';
  end if;
  if not public.app_can(p_collection, true) then
    raise exception 'Your role cannot change %', p_collection using errcode = '42501';
  end if;

  -- Members cannot change or remove items that other people created
  -- in the lists that are private to each member.
  if lvl < 2 and coalesce((select own_only from public.app_collection_rules where name = p_collection), false) then
    if p_replace then
      raise exception 'Members cannot rewrite this list' using errcode = '42501';
    end if;
    if exists (select 1 from public.app_records r
                where r.collection = p_collection
                  and (r.id = any(coalesce(p_deletes, '{}'))
                       or r.id in (select x->>'id' from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) x))
                  and r.created_by is distinct from auth.uid()) then
      raise exception 'You can only change your own items' using errcode = '42501';
    end if;
  end if;

  -- Members: payments always start as "pending"; only staff can verify or reject.
  if p_collection = 'gtg_payments' and lvl < 2 then
    if p_replace or coalesce(array_length(p_deletes, 1), 0) > 0 then
      raise exception 'Members cannot remove payments' using errcode = '42501';
    end if;
    for u in select * from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) loop
      select data->>'status' into old_status from public.app_records
       where collection = p_collection and id = u->>'id';
      if not found and coalesce(u->'data'->>'status', 'pending') <> 'pending' then
        raise exception 'New payments must be pending' using errcode = '42501';
      end if;
      if found and coalesce(u->'data'->>'status', '') is distinct from coalesce(old_status, '') then
        raise exception 'Only staff can change a payment status' using errcode = '42501';
      end if;
    end loop;
  end if;

  insert into public.app_collections (name, shape) values (p_collection, p_shape)
  on conflict (name) do update set shape = excluded.shape, updated_at = now();

  if p_replace then
    delete from public.app_records where collection = p_collection and client_ts <= p_ts;
  end if;

  if coalesce(array_length(p_deletes, 1), 0) > 0 then
    delete from public.app_records
     where collection = p_collection and id = any(p_deletes) and client_ts <= p_ts;
    get diagnostics n_del = row_count;
  end if;

  insert into public.app_records (collection, id, data, sort_order, client_ts, created_by, updated_by, updated_at)
  select p_collection, x->>'id', x->'data', coalesce((x->>'sort_order')::int, 0), p_ts, auth.uid(), auth.uid(), now()
    from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) x
  on conflict (collection, id) do update
     set data = excluded.data, sort_order = excluded.sort_order, client_ts = excluded.client_ts,
         updated_by = excluded.updated_by, updated_at = now()
   where public.app_records.client_ts <= excluded.client_ts;
  get diagnostics n_up = row_count;

  return jsonb_build_object('ok', true, 'upserted', n_up, 'deleted', n_del);
end $$;

-- ---------------------------------------------------------------------
-- Contact form (anyone, logged in or not, can send a message)
-- ---------------------------------------------------------------------
drop function if exists public.submit_contact(text, text, text, text, text);
create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  first_name  text not null,
  last_name   text not null default '',
  email       text not null,
  phone       text not null default '',
  topic       text not null default '',
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function public.submit_contact(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_topic text, p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_email), '') = ''
     or coalesce(trim(p_message), '') = '' then
    raise exception 'Please fill in your name, email and message';
  end if;
  if length(p_message) > 5000 then
    raise exception 'Message is too long';
  end if;
  insert into public.contact_messages (first_name, last_name, email, phone, topic, message)
  values (left(trim(p_first_name), 100), left(coalesce(trim(p_last_name), ''), 100),
          left(trim(p_email), 200), left(coalesce(trim(p_phone), ''), 50),
          left(coalesce(trim(p_topic), ''), 100), p_message);
  return jsonb_build_object('ok', true);
end $$;

-- The logged-in user's own profile.
create or replace function public.my_profile()
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security. The website only goes through the functions
--    above; direct table access is limited to what each role may see.
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.app_collections       enable row level security;
alter table public.app_records           enable row level security;
alter table public.app_collection_rules  enable row level security;
alter table public.contact_messages      enable row level security;

drop policy if exists contact_staff_read on public.contact_messages;
drop policy if exists contact_staff_update on public.contact_messages;
create policy contact_staff_read on public.contact_messages for select
  using (public.app_level(public.my_role()) >= 3);
create policy contact_staff_update on public.contact_messages for update
  using (public.app_level(public.my_role()) >= 3)
  with check (public.app_level(public.my_role()) >= 3);

drop policy if exists profiles_read  on public.profiles;
drop policy if exists profiles_admin on public.profiles;
create policy profiles_read  on public.profiles for select
  using (id = auth.uid() or public.app_level(public.my_role()) >= 3);
create policy profiles_admin on public.profiles for update
  using (public.app_level(public.my_role()) >= 3)
  with check (public.app_level(public.my_role()) >= 3);

drop policy if exists collections_read on public.app_collections;
create policy collections_read on public.app_collections for select
  using (public.app_can(name, false));

drop policy if exists records_read on public.app_records;
create policy records_read on public.app_records for select
  using (public.app_can(collection, false) and public.app_row_visible(collection, created_by));

drop policy if exists rules_read on public.app_collection_rules;
create policy rules_read on public.app_collection_rules for select using (true);

grant execute on function public.app_dump()   to anon, authenticated;
grant execute on function public.submit_contact(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.app_sync(text, text, jsonb, text[], boolean, bigint) to authenticated;
revoke execute on function public.app_sync(text, text, jsonb, text[], boolean, bigint) from anon, public;

-- Table access for logged-in users (rows are still limited by the policies above).
-- Needed on projects where "Grant API access to new tables automatically" is off.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.app_collections, public.app_records,
                public.app_collection_rules, public.contact_messages to authenticated;
grant update on public.profiles, public.contact_messages to authenticated;

-- ---------------------------------------------------------------------
-- 6. Easy-to-read views for the Supabase Table Editor / reports.
-- ---------------------------------------------------------------------
create or replace view public.v_payments with (security_invoker = true) as
select id,
       data->>'member'    as member,
       data->>'kind'      as kind,
       data->>'className' as class_name,
       data->>'category'  as category,
       (data->>'amount')::numeric as amount,
       data->>'via'       as paid_via,
       data->>'reference' as reference,
       data->>'status'    as status,
       (data->>'createdAt')::timestamptz  as created_at,
       nullif(data->>'verifiedAt','')::timestamptz as verified_at,
       updated_at
  from public.app_records where collection = 'gtg_payments';

create or replace view public.v_trainers with (security_invoker = true) as
select id, data->>'name' as name, data, updated_at
  from public.app_records where collection = 'gtg_trainers';

create or replace view public.v_classes with (security_invoker = true) as
select id, data->>'name' as name, (data->>'members')::int as members, updated_at
  from public.app_records where collection = 'gtg_classes';

create or replace view public.v_employees with (security_invoker = true) as
select id, data->>'last' as last_name, data->>'first' as first_name,
       data->>'position' as position, data->>'email' as email, data->>'phone' as phone, updated_at
  from public.app_records where collection = 'gtg_employees';

create or replace view public.v_equipment with (security_invoker = true) as
select id, data->>'name' as name, data->>'category' as category,
       (data->>'qty')::int as qty, data->>'condition' as condition,
       (data->>'price')::numeric as price, updated_at
  from public.app_records where collection = 'gtg_equipment';

create or replace view public.v_feedback with (security_invoker = true) as
select id, data->>'member' as member, data->>'category' as category,
       data->>'target' as target, data->>'rating' as rating, data, updated_at
  from public.app_records where collection = 'gtg_feedback';

create or replace view public.v_enrollments with (security_invoker = true) as
select id, data, updated_at
  from public.app_records where collection = 'gtg_enrollments';

-- ---------------------------------------------------------------------
-- 7. The four test accounts the old login page had (same passwords).
--    Change the passwords in Authentication > Users before going live.
-- ---------------------------------------------------------------------
do $$
declare
  acc record;
  uid uuid;
begin
  for acc in select * from (values
      ('member1@gmail.com',  'member',  'member',  'Rafaela', 'Madriaga'),
      ('trainer1@gmail.com', 'trainer', 'trainer', 'Test',    'Trainer'),
      ('admin1@gmail.com',   'admin',   'admin',   'Test',    'Admin'),
      ('owner1@gmail.com',   'owner',   'owner',   'Test',    'Owner')
    ) as t(email, pw, role, first_name, last_name)
  loop
    select id into uid from auth.users where email = acc.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                              email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                              created_at, updated_at, confirmation_token, email_change,
                              email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
              acc.email, extensions.crypt(acc.pw, extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name', acc.first_name, 'last_name', acc.last_name),
              now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
              jsonb_build_object('sub', uid::text, 'email', acc.email, 'email_verified', true),
              'email', now(), now(), now());
    end if;
    insert into public.profiles (id, email, first_name, last_name, role)
    values (uid, acc.email, acc.first_name, acc.last_name, acc.role)
    on conflict (id) do update set role = excluded.role;
  end loop;
end $$;

grant select on public.v_payments, public.v_trainers, public.v_classes, public.v_employees,
                public.v_equipment, public.v_feedback, public.v_enrollments to authenticated;

-- Done. Check: select * from public.profiles;
