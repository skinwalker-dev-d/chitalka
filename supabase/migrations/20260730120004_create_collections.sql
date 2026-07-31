create table public.collections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint collections_user_name_unique unique (user_id, name)
);

create index collections_user_id_idx on public.collections (user_id);

alter table public.collections enable row level security;

create policy "Users can view their collections"
  on public.collections for select using ((select auth.uid()) = user_id);

create policy "Users can add their collections"
  on public.collections for insert with check ((select auth.uid()) = user_id);

create policy "Users can update their collections"
  on public.collections for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users can delete their collections"
  on public.collections for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.collections to authenticated;
