create extension if not exists pgcrypto;

create table if not exists public.telegram_phone_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  verified_at timestamptz,
  telegram_user_id bigint,
  phone_hash text,
  phone_last4 text,
  created_at timestamptz not null default now()
);

create index if not exists telegram_phone_verification_user_idx
  on public.telegram_phone_verification_sessions(user_id, created_at desc);

alter table public.telegram_phone_verification_sessions enable row level security;
grant select, insert on public.telegram_phone_verification_sessions to authenticated;

drop policy if exists "telegram_phone_verify_self_select" on public.telegram_phone_verification_sessions;
create policy "telegram_phone_verify_self_select"
  on public.telegram_phone_verification_sessions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "telegram_phone_verify_self_insert" on public.telegram_phone_verification_sessions;
create policy "telegram_phone_verify_self_insert"
  on public.telegram_phone_verification_sessions for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.start_telegram_phone_verification()
returns table(token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text := encode(gen_random_bytes(24), 'base64url');
  hash text := encode(digest(raw_token, 'sha256'), 'hex');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.telegram_phone_verification_sessions
   where user_id = auth.uid()
     and (verified_at is null or verified_at < now() - interval '1 day');

  insert into public.telegram_phone_verification_sessions(user_id, token_hash)
  values (auth.uid(), hash);

  return query select raw_token;
end;
$$;

revoke all on function public.start_telegram_phone_verification() from public, anon;
grant execute on function public.start_telegram_phone_verification() to authenticated;

create or replace function public.get_my_telegram_phone_verification()
returns table(verified boolean, phone_last4 text, verified_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(v.verified, false),
    v.phone_last4,
    v.verified_at
  from (values (1)) x(n)
  left join lateral (
    select true as verified, s.phone_last4, s.verified_at
      from public.telegram_phone_verification_sessions s
     where s.user_id = auth.uid()
       and s.verified_at is not null
     order by s.verified_at desc
     limit 1
  ) v on true;
$$;

revoke all on function public.get_my_telegram_phone_verification() from public, anon;
grant execute on function public.get_my_telegram_phone_verification() to authenticated;

create or replace function public.mark_telegram_phone_verified(
  _token text,
  _telegram_user_id bigint,
  _phone_hash text,
  _phone_last4 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.telegram_phone_verification_sessions
     set verified_at = now(),
         telegram_user_id = _telegram_user_id,
         phone_hash = _phone_hash,
         phone_last4 = _phone_last4
   where token_hash = encode(digest(_token, 'sha256'), 'hex')
     and expires_at > now()
     and verified_at is null;

  if not found then
    raise exception 'invalid_or_expired_token';
  end if;
end;
$$;

revoke all on function public.mark_telegram_phone_verified(text, bigint, text, text) from public, anon, authenticated;
