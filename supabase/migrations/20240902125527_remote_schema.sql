CREATE UNIQUE INDEX groups_name_key ON public.groups USING btree (name);

alter table "public"."groups" add constraint "groups_name_key" UNIQUE using index "groups_name_key";


