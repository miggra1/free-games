-- Free、恒谊战队后台。请在 Supabase SQL Editor 中完整执行一次。
create extension if not exists pgcrypto;

create table if not exists public.free_team_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  role text not null default 'admin' check (role in ('owner', 'admin', 'coach')),
  created_at timestamptz not null default now()
);

create table if not exists public.team_match_requests (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null check (char_length(opponent_name) between 1 and 48),
  contact_name text not null check (char_length(contact_name) between 1 and 32),
  contact_method text not null check (char_length(contact_method) between 1 and 80),
  proposed_at timestamptz not null,
  format text not null check (format in ('BO1', 'BO3', 'BO5', '训练赛')),
  roster_note text not null default '',
  message text not null check (char_length(message) between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'completed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  scheduled_for date not null,
  plan_type text not null check (plan_type in ('训练赛', '约战', '复盘', '招募', '赛事准备')),
  content text not null check (char_length(content) between 1 and 1200),
  status text not null default 'planned' check (status in ('planned', 'active', 'done', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.free_team_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.free_team_admins where user_id = auth.uid()); $$;

create or replace function public.bootstrap_free_team_admin(staff_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception '请先登录。'; end if;
  if exists (select 1 from public.free_team_admins) then raise exception '管理员已存在，请联系战队负责人授权。'; end if;
  insert into public.free_team_admins (user_id, display_name, role)
  values (auth.uid(), left(coalesce(nullif(trim(staff_name), ''), 'Free 管理员'), 24), 'owner');
end;
$$;

alter table public.free_team_admins enable row level security;
alter table public.team_match_requests enable row level security;
alter table public.team_plans enable row level security;

create policy "Team admins can read their membership" on public.free_team_admins for select to authenticated using (user_id = auth.uid());
create policy "Team admins can manage match requests" on public.team_match_requests for all to authenticated using ((select public.free_team_is_admin())) with check ((select public.free_team_is_admin()));
create policy "Team admins can manage plans" on public.team_plans for all to authenticated using ((select public.free_team_is_admin())) with check ((select public.free_team_is_admin()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.team_match_requests, public.team_plans to authenticated;
grant select on public.free_team_admins to authenticated;
grant execute on function public.bootstrap_free_team_admin(text) to authenticated;
