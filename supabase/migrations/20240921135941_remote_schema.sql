drop policy "Enable read access for all users" on "public"."groups";

create policy "Enable read access for all users"
on "public"."groups"
as permissive
for select
to authenticated, supabase_admin, anon
using (true);



