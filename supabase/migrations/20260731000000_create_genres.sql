create table public.genres (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(user_id, name)
);
alter table public.genres enable row level security;
create policy "genres_user_policy"
  on public.genres for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.genres to authenticated;
