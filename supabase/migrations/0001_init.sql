-- =============================================================================
-- kharn-ages-builder - schéma initial (comptes, listes, versions du catalogue)
--
-- À appliquer dans le SQL Editor du dashboard Supabase (copier-coller, puis Run).
-- Rappel sécurité : la clé publishable est publique, la RLS est la SEULE protection.
-- Tout est fail-closed : RLS activée + policies explicites ci-dessous.
--
-- Ordre important : les tables sont créées AVANT la fonction `is_admin()` (fonction
-- SQL validée à la création, elle référence `public.profiles`).
-- =============================================================================

-- ── Table profiles ──────────────────────────────────────────────────────────
-- Un profil par compte auth. `role` distingue user (défaut) et admin.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  pseudo     text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chacun ne lit et ne met à jour que son propre profil.
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Anti-escalade de privilège : on n'accorde à `authenticated` que la mise à jour
-- de `pseudo`. Toute tentative de modifier `role` via l'API est refusée par Postgres
-- (permission de colonne). La promotion en admin se fait à la main dans le SQL Editor.
grant select on public.profiles to authenticated;
grant update (pseudo) on public.profiles to authenticated;

-- Création automatique du profil à l'inscription (trigger sur auth.users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pseudo', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helper : l'utilisateur courant est-il admin ? ───────────────────────────
-- SECURITY DEFINER pour lire `profiles` en contournant la RLS (sinon récursion).
-- Défini après `profiles` : une fonction `language sql` est validée à la création.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Table lists ─────────────────────────────────────────────────────────────
-- Une ligne par liste du joueur. `data` = ListDocument sérialisé (jsonb).
-- `id` en text pour accepter l'identifiant généré côté app (réconciliation Dexie).
create table if not exists public.lists (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lists_user_id_idx on public.lists (user_id);

alter table public.lists enable row level security;

-- Owner-only sur toutes les opérations.
create policy "lists_select_own"
  on public.lists for select
  using (user_id = auth.uid());

create policy "lists_insert_own"
  on public.lists for insert
  with check (user_id = auth.uid());

create policy "lists_update_own"
  on public.lists for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lists_delete_own"
  on public.lists for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.lists to authenticated;

-- ── Table catalog_versions ──────────────────────────────────────────────────
-- Historique append-only du catalogue. Lecture publique, écriture admin.
-- La dernière version (id le plus élevé) est celle servie à l'app.
create table if not exists public.catalog_versions (
  id           bigint generated always as identity primary key,
  version      text not null,
  data         jsonb not null,
  author_id    uuid references auth.users (id),
  published_at timestamptz not null default now()
);

alter table public.catalog_versions enable row level security;

-- Lecture ouverte à tous (anon + authenticated) : le catalogue est public.
create policy "catalog_versions_select_all"
  on public.catalog_versions for select
  using (true);

-- Écriture réservée aux admins, et l'auteur doit être l'utilisateur courant.
create policy "catalog_versions_insert_admin"
  on public.catalog_versions for insert
  with check (public.is_admin() and author_id = auth.uid());

grant select on public.catalog_versions to anon, authenticated;
grant insert on public.catalog_versions to authenticated;
