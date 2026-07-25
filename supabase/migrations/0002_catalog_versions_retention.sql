-- =============================================================================
-- kharn-ages-builder - rétention de l'historique du catalogue
--
-- À appliquer dans le SQL Editor du dashboard Supabase (copier-coller, puis Run).
--
-- Chaque version publiée stocke une copie complète du catalogue (plusieurs Mo, icônes
-- comprises). L'historique ne sert qu'à revenir en arrière en cas de mauvaise publication :
-- quelques versions suffisent. On ne garde donc que les N dernières, purgées automatiquement
-- à chaque publication.
--
-- Purge côté serveur (et non côté app) : elle s'applique quel que soit le client qui publie,
-- et n'oblige pas à accorder le DELETE sur `catalog_versions` au navigateur.
-- =============================================================================

-- Nombre de versions conservées. Changer cette valeur suffit à ajuster la rétention :
-- la prochaine publication appliquera la nouvelle limite.
create or replace function public.catalog_versions_kept()
returns integer
language sql
immutable
as $$ select 10 $$;

-- SECURITY DEFINER : le trigger supprime au nom du propriétaire de la table, sans qu'aucun
-- droit de suppression ne soit accordé aux comptes de l'application.
create or replace function public.prune_catalog_versions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.catalog_versions
  where id not in (
    select id from public.catalog_versions
    order by id desc
    limit public.catalog_versions_kept()
  );
  return null;
end;
$$;

-- AFTER INSERT ... FOR EACH STATEMENT : une seule purge par publication.
drop trigger if exists on_catalog_version_published on public.catalog_versions;
create trigger on_catalog_version_published
  after insert on public.catalog_versions
  for each statement execute function public.prune_catalog_versions();

-- Applique la rétention à l'historique déjà en place (sans attendre la prochaine publication).
delete from public.catalog_versions
where id not in (
  select id from public.catalog_versions
  order by id desc
  limit public.catalog_versions_kept()
);
