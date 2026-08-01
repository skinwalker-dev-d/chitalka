create table public.shelves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  name text not null,
  book_ids integer[] default '{}',
  created_at timestamptz default now()
);
alter table public.shelves enable row level security;
create policy "shelves_user_policy"
  on public.shelves for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant all on public.shelves to authenticated;
