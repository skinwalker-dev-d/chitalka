alter table public.collections add column if not exists position integer not null default 0;
alter table public.goals      add column if not exists position integer not null default 0;
alter table public.genres     add column if not exists position integer not null default 0;

-- Backfill existing rows with stable initial order
with ranked as (
  select id, (row_number() over (partition by user_id order by created_at) - 1) as rn
  from public.collections
)
update public.collections c set position = r.rn from ranked r where c.id = r.id;

with ranked as (
  select id, (row_number() over (partition by user_id order by created_at) - 1) as rn
  from public.goals
)
update public.goals g set position = r.rn from ranked r where g.id = r.id;

with ranked as (
  select id, (row_number() over (partition by user_id order by created_at) - 1) as rn
  from public.genres
)
update public.genres g set position = r.rn from ranked r where g.id = r.id;
