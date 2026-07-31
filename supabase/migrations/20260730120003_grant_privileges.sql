-- Supabase local does not auto-grant table privileges unlike the hosted dashboard.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
