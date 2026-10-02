-- 봄결 전용 새 프로젝트에 적용. 기존 앱의 테이블/데이터를 변경하지 않습니다.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$' and slug not like 'sample-%'),
  template_id text not null,
  type text not null check (type in ('wedding','dol','party')),
  data jsonb not null check (octet_length(data::text) <= 65536),
  published boolean not null default false,
  expires_at timestamptz not null default (now() + interval '1 year'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data->>'slug' = slug and data->>'templateId' = template_id and data->>'type' = type),
  check (jsonb_typeof(data->'gallery') = 'array' and jsonb_array_length(data->'gallery') <= 30)
);
create index invitations_owner on public.invitations(owner_id, updated_at desc);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to anon, authenticated;
-- All mutations are server-only so direct Data API calls cannot bypass request/image validation.
create policy invitations_read on public.invitations for select to anon, authenticated
  using ((published and expires_at > now()) or owner_id = (select auth.uid()));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (owner_id = (select auth.uid()) and not published);
create policy invitations_update on public.invitations for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy invitations_delete on public.invitations for delete to authenticated
  using (owner_id = (select auth.uid()));

create table public.invitation_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes integer not null check (bytes between 1 and 1048576),
  created_at timestamptz not null default now(),
  unique(owner_id, sha256)
);
create index invitation_photos_owner on public.invitation_photos(owner_id);
alter table public.invitation_photos enable row level security;
revoke all on public.invitation_photos from anon, authenticated;
grant select on public.invitation_photos to authenticated;
create policy photos_owner on public.invitation_photos for select to authenticated
  using (owner_id = (select auth.uid()));

create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null check (length(name) between 1 and 12),
  message text not null check (length(message) between 1 and 300),
  password_hash text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index guestbook_page on public.guestbook(invitation_id, created_at desc) where deleted_at is null;
alter table public.guestbook enable row level security;
revoke all on public.guestbook from anon, authenticated;
grant select (id, invitation_id, name, message, created_at, deleted_at) on public.guestbook to anon, authenticated;
create policy guestbook_visible on public.guestbook for select to anon, authenticated
  using (deleted_at is null and exists (select 1 from public.invitations i where i.id = invitation_id
    and (i.owner_id = (select auth.uid()) or (i.published and i.expires_at > now()))));
-- Guest writes go through authenticated server Route Handlers, never bypassing validation/limits.

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  side text not null check (side in ('groom','bride','host')),
  name text not null check (length(name) between 1 and 20),
  attending boolean not null,
  count integer not null check (count between 1 and 20),
  meal text not null check (meal in ('yes','no','unknown')),
  memo text not null default '' check (length(memo) <= 60),
  created_at timestamptz not null default now()
);
create index rsvps_invitation on public.rsvps(invitation_id, created_at desc);
alter table public.rsvps enable row level security;
revoke all on public.rsvps from anon, authenticated;
grant select on public.rsvps to authenticated;
create policy rsvps_owner on public.rsvps for select to authenticated
  using (exists(select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid())));

grant all on public.invitations, public.invitation_photos, public.guestbook, public.rsvps to service_role;

create function private.limit_responses() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare entries bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.invitation_id::text, 1));
  if tg_table_name = 'rsvps' then
    select count(*) into entries from public.rsvps where invitation_id = new.invitation_id;
  else
    select count(*) into entries from public.guestbook where invitation_id = new.invitation_id;
  end if;
  if entries >= 1000 then raise exception 'quota_exceeded'; end if;
  return new;
end $$;
create trigger rsvps_limit before insert on public.rsvps for each row execute function private.limit_responses();
create trigger guestbook_limit before insert on public.guestbook for each row execute function private.limit_responses();

create table private.request_counters (
  actor text not null,
  window_seconds integer not null check(window_seconds > 0),
  bucket bigint not null,
  amount bigint not null check(amount >= 0),
  primary key(actor, window_seconds, bucket)
);
alter table private.request_counters enable row level security;
create table private.idempotency (
  key text primary key,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now()
);
alter table private.idempotency enable row level security;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

-- Serialize checks and reservation: concurrent requests cannot exceed a daily byte or request budget.
create function public.consume_limits(limits jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare item jsonb; period integer; slot bigint; current_amount bigint; increment bigint; ceiling bigint;
begin
  if jsonb_typeof(limits) <> 'array' or jsonb_array_length(limits) not between 1 and 12 then
    raise exception 'invalid_limits';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(9202601002);
  for item in select value from jsonb_array_elements(limits) loop
    period := (item->>'seconds')::integer;
    increment := (item->>'amount')::bigint;
    ceiling := (item->>'max')::bigint;
    if period <= 0 or increment <= 0 or ceiling <= 0 then raise exception 'invalid_limits'; end if;
    slot := floor(extract(epoch from now()) / period)::bigint;
    select amount into current_amount from private.request_counters
      where actor = item->>'actor' and window_seconds = period and bucket = slot;
    if coalesce(current_amount, 0) + increment > ceiling then raise exception 'quota_exceeded'; end if;
    insert into private.request_counters(actor, window_seconds, bucket, amount)
      values(item->>'actor', period, slot, increment)
      on conflict(actor, window_seconds, bucket) do update
        set amount = private.request_counters.amount + increment;
  end loop;
  delete from private.request_counters where (bucket + 1) * window_seconds < extract(epoch from now() - interval '2 days');
end $$;
revoke all on function public.consume_limits(jsonb) from public, anon, authenticated;
grant execute on function public.consume_limits(jsonb) to service_role;

-- Idempotency key is a keyed digest of operation + actor + client UUID, never raw personal data.
create function public.begin_write(write_key text, payload_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry private.idempotency;
begin
  perform pg_catalog.pg_advisory_xact_lock(9202601002);
  delete from private.idempotency where created_at < now() - interval '1 day';
  select * into entry from private.idempotency where key = write_key;
  if found then
    if entry.request_hash <> payload_hash then raise exception 'idempotency_conflict'; end if;
    if entry.response is null then raise exception 'write_in_progress'; end if;
    return jsonb_build_object('replay', true, 'response', entry.response);
  end if;
  insert into private.idempotency(key, request_hash) values(write_key, payload_hash);
  return jsonb_build_object('replay', false);
end $$;
create function public.finish_write(write_key text, result jsonb) returns void
language sql security definer set search_path = '' as $$
  update private.idempotency set response = result where key = write_key;
$$;
revoke all on function public.begin_write(text,text), public.finish_write(text,jsonb) from public, anon, authenticated;
grant execute on function public.begin_write(text,text), public.finish_write(text,jsonb) to service_role;

create function private.limit_owner_invitations() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 0));
  if (select count(*) from public.invitations where owner_id = new.owner_id) >= 5 then
    raise exception 'invitation_limit';
  end if;
  return new;
end $$;
create trigger invitations_owner_limit before insert on public.invitations
  for each row execute function private.limit_owner_invitations();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values('invitation-photos', 'invitation-photos', false, 1048576, array['image/webp'])
  on conflict(id) do nothing;
-- No direct client INSERT/UPDATE/DELETE or public bucket access. The server grants access only
-- after ownership, publication, quota and image validation; private drafts are not publicly readable.
