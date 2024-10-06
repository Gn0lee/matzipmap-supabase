create type "public"."MEMBERSHIP_ROLE" as enum ('MEMBER', 'OWNER');

alter table "public"."user-group-memberships" add column "role" "MEMBERSHIP_ROLE" not null default 'MEMBER'::"MEMBERSHIP_ROLE";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user_membership_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public."user-membership-limits" (user_id, max_groups)
  VALUES (NEW.id, 3);
  RETURN NEW;
END;
$function$
;


