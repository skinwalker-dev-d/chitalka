-- Add position column to shelves table for reordering support
alter table public.shelves add column if not exists position integer not null default 0;

-- Backfill existing rows with stable initial order
with ranked as (
  select id, (row_number() over (partition by collection_id order by created_at) - 1) as rn
  from public.shelves
)
update public.shelves s set position = r.rn from ranked r where s.id = r.id;

-- Ensure RLS policy allows inserts by explicitly checking user_id
drop policy if exists "shelves_user_policy" on public.shelves;
create policy "shelves_select_policy"
  on public.shelves for select
  using (auth.uid() = user_id);
create policy "shelves_insert_policy"
  on public.shelves for insert
  with check (auth.uid() = user_id);
create policy "shelves_update_policy"
  on public.shelves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "shelves_delete_policy"
  on public.shelves for delete
  using (auth.uid() = user_id);
