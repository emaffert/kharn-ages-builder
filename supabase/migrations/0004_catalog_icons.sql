-- =============================================================================
-- kharn-ages-builder - bucket des icônes de catalogue
--
-- À appliquer dans le SQL Editor du dashboard Supabase (copier-coller, puis Run).
--
-- Le catalogue ne transporte plus les portraits en base64 : il ne garde qu'une référence
-- `<hash>.webp`, et les octets vivent ici. Deux conséquences directes :
--   - une version publiée pèse ~200 Ko au lieu de 2,4 Mo, et l'historique des 10 versions
--     conservées cesse de multiplier les mêmes images par dix ;
--   - une icône créée depuis l'admin déployé est disponible sans attendre un redéploiement.
--
-- Le nom EST le hash du contenu : un objet est donc immuable, et réenvoyer deux fois la même
-- icône ne peut pas créer de doublon ni invalider un cache.
-- =============================================================================

-- ── Bucket ──────────────────────────────────────────────────────────────────
-- Public en LECTURE : les portraits s'affichent pour des joueurs non connectés, et un `<img src>`
-- ne porte aucun jeton. L'écriture reste gouvernée par les policies ci-dessous.
--
-- Les deux garde-fous comptent : sans eux, tout compte admin (présent ou futur) pourrait déposer
-- un fichier arbitraire de taille arbitraire dans un bucket servi publiquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-icons', 'catalog-icons', true, 524288, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies d'accès aux objets ─────────────────────────────────────────────
-- `storage.objects` a déjà la RLS activée (géré par Supabase) ; on n'ajoute que nos règles.

drop policy if exists "catalog_icons_select_all" on storage.objects;
create policy "catalog_icons_select_all"
  on storage.objects for select
  using (bucket_id = 'catalog-icons');

drop policy if exists "catalog_icons_insert_admin" on storage.objects;
create policy "catalog_icons_insert_admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-icons' and public.is_admin());

-- L'éditeur téléverse en `upsert` : réenregistrer une icône identique retombe sur le même nom,
-- et doit réussir plutôt que de buter sur un conflit.
drop policy if exists "catalog_icons_update_admin" on storage.objects;
create policy "catalog_icons_update_admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'catalog-icons' and public.is_admin())
  with check (bucket_id = 'catalog-icons' and public.is_admin());

-- Suppression réservée aux admins : c'est par là que passe la purge, qui appelle l'API Storage
-- avec le jeton de l'admin (cf. `orphan_icon_names` ci-dessous).
drop policy if exists "catalog_icons_delete_admin" on storage.objects;
create policy "catalog_icons_delete_admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-icons' and public.is_admin());

-- ── Références vivantes ─────────────────────────────────────────────────────
-- Toutes les icônes citées par au moins une version conservée, aux trois endroits où le schéma
-- en accepte une : la table partagée `icons`, et les dérogations par niveau sur `profiles` et
-- `mounts`. `coalesce` protège des versions anciennes où la clé peut manquer.
create or replace function public.referenced_icon_names()
returns table (name text)
language sql
stable
security definer
set search_path = public
as $$
  select v.value #>> '{}'
    from public.catalog_versions cv,
         lateral jsonb_each(coalesce(cv.data -> 'icons', '{}'::jsonb)) as v
  union
  select p.value ->> 'icon'
    from public.catalog_versions cv,
         lateral jsonb_array_elements(coalesce(cv.data -> 'profiles', '[]'::jsonb)) as p
  union
  select m.value ->> 'icon'
    from public.catalog_versions cv,
         lateral jsonb_array_elements(coalesce(cv.data -> 'mounts', '[]'::jsonb)) as m
$$;

-- ── Purge : identification des orphelines ───────────────────────────────────
-- Cette fonction ne supprime RIEN, elle nomme. Supprimer une ligne de `storage.objects` en SQL
-- retire la métadonnée sans libérer le fichier du stockage : seule l'API Storage efface vraiment.
-- L'admin appelle donc cette fonction, puis `storage.remove()` avec la liste obtenue.
--
-- `grace` protège le travail en cours : une icône est enregistrée (donc téléversée) AVANT d'être
-- publiée. Sans ce délai, une purge lancée entre l'enregistrement et la publication effacerait
-- l'icône sous les pieds du brouillon.
create or replace function public.orphan_icon_names(grace interval default interval '30 days')
returns table (name text, created_at timestamptz, size bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.name,
         o.created_at,
         (o.metadata ->> 'size')::bigint
    from storage.objects o
   where public.is_admin()
     and o.bucket_id = 'catalog-icons'
     and o.created_at < now() - grace
     -- `not exists` et non `not in` : une seule référence NULL suffirait à rendre `not in` faux
     -- pour toutes les lignes, et la purge ne trouverait plus jamais rien.
     and not exists (
       select 1 from public.referenced_icon_names() r
        where r.name = o.name
     )
   order by o.created_at;
$$;

-- Réservée aux comptes connectés ; le `is_admin()` du corps fait le reste (un non-admin obtient
-- zéro ligne, jamais la liste du bucket).
revoke all on function public.orphan_icon_names(interval) from public, anon;
grant execute on function public.orphan_icon_names(interval) to authenticated;

revoke all on function public.referenced_icon_names() from public, anon;
grant execute on function public.referenced_icon_names() to authenticated;
