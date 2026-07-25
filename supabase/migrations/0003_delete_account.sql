-- =============================================================================
-- kharn-ages-builder - suppression de son propre compte
--
-- À appliquer dans le SQL Editor du dashboard Supabase (copier-coller, puis Run).
--
-- Supprimer une ligne de `auth.users` demande des droits que le navigateur n'a pas (et ne doit
-- pas avoir) : la clé publishable ne peut pas toucher au schéma `auth`. On expose donc une
-- fonction SECURITY DEFINER qui ne sait faire qu'une chose : supprimer le compte de l'appelant.
--
-- `auth.uid()` vient du jeton de l'appelant : impossible de viser le compte d'un tiers. Si le
-- jeton est absent, `auth.uid()` vaut NULL et la suppression ne touche aucune ligne.
--
-- Les données suivent automatiquement : `profiles.id` et `lists.user_id` référencent
-- `auth.users (id)` avec ON DELETE CASCADE (cf. migration 0001).
-- =============================================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Aucun compte connecté.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Réservée aux comptes connectés : ni les visiteurs anonymes, ni le rôle public.
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
