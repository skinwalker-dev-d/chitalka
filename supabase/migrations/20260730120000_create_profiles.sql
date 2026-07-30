create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  about text not null default '',
  reading_preferences text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their profile"
  on public.profiles for select using ((select auth.uid()) = id);

create policy "Users can update their profile"
  on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users can create their profile"
  on public.profiles for insert with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Users can manage their avatar"
  on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));