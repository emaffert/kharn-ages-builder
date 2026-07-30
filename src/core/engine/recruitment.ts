import type { Catalog, Equipment, Profile } from "../model";

/**
 * Voies d'accès d'un profil à un Fer de Lance d'une autre faction, partagées par le moteur
 * (validation) et le constructeur (roster, coûts, verrouillage du sceau).
 *
 * Trois voies existent : le trait `apatride` (recrutable partout), la contrainte
 * `faction-membership` (« Allié des X »), et le **sceau** - un objet qui octroie `apatride` à son
 * porteur (« Sceau de la guilde noire », +10 Ko, FAQ Janv. 2026 + carte p. 79).
 */

/** Trait « recrutable dans le fer-de-lance de n'importe quelle faction ». */
export const APATRIDE = "apatride";
/** Trait des « Frères d'Armes » : apatrides dès qu'ils sont 2 dans un même Fer de Lance. */
export const FRERE_D_ARMES = "frere-d-armes";

/** Une figurine correspond-elle à la réservation d'un équipement ? (toutes les dimensions fournies). */
export function equipmentReservedOk(eq: Equipment, p: Profile): boolean {
  const r = eq.reservedTo;
  if (!r) return true;
  if (r.profileIds && !r.profileIds.includes(p.id)) return false;
  if (r.modelIds && !(p.modelId != null && r.modelIds.includes(p.modelId))) return false;
  if (r.traits && !r.traits.some((t) => p.traits.includes(t))) return false;
  if (r.levels && !(p.level != null && r.levels.includes(p.level))) return false;
  if (r.factionIds && !(p.factionId != null && r.factionIds.includes(p.factionId))) return false;
  return true;
}

/** Factions d'accueil ouvertes par les contraintes « Allié des X » portées par le profil. */
export function alliedFactions(p: Profile): string[] {
  return (p.recruitment ?? []).flatMap((c) =>
    c.type === "faction-membership"
      ? ((c.params as { allowedFactions?: unknown }).allowedFactions as string[] | undefined) ?? []
      : [],
  );
}

/**
 * Le profil est-il recrutable dans ce Fer de Lance **sans rien payer ni réunir** ? Même faction,
 * profil sans logo, `apatride` imprimé sur la carte, ou « Allié des X ». Les octrois de trait
 * (carte « Frères d'Armes », sceau) ne comptent pas ici : ils dépendent de la liste ou d'un achat.
 */
export function recruitableWithoutSeal(p: Profile, factionId: string): boolean {
  if (!p.factionId || p.factionId === factionId) return true;
  if (p.traits.includes(APATRIDE)) return true;
  return alliedFactions(p).includes(factionId);
}

/**
 * Le « sceau » accessible à ce profil : un équipement qui octroie `apatride` à son porteur et dont
 * la réservation l'accepte. Aucun identifiant n'est codé en dur - la règle vient du catalogue.
 */
export function sealFor(cat: Catalog, p: Profile): Equipment | undefined {
  return cat.equipment.find(
    (e) =>
      equipmentReservedOk(e, p) &&
      (e.effects ?? []).some(
        (ef) =>
          ef.target.self && ef.operation.kind === "grant-trait" && ef.operation.trait === APATRIDE,
      ),
  );
}

/** Sceau **proposé à l'achat** dans ce Fer de Lance : le profil n'y est pas recrutable autrement. */
export function sealOfferedFor(cat: Catalog, p: Profile, factionId: string): Equipment | undefined {
  return recruitableWithoutSeal(p, factionId) ? undefined : sealFor(cat, p);
}

/**
 * Sceau **imposé** au recrutement : porté d'office et non retirable. Les frères d'armes en sont
 * exemptés - ils se recrutent par deux (ils deviennent alors apatrides) et n'achètent le sceau que
 * pour tenir seuls dans un Fer de Lance étranger.
 */
export function sealRequiredFor(cat: Catalog, p: Profile, factionId: string): Equipment | undefined {
  if (p.traits.includes(FRERE_D_ARMES)) return undefined;
  return sealOfferedFor(cat, p, factionId);
}

/** Le profil peut-il figurer au roster de cette faction ? (une voie d'accès existe, même payante) */
export function isRecruitableIn(cat: Catalog, p: Profile, factionId: string): boolean {
  if (recruitableWithoutSeal(p, factionId)) return true;
  // Les frères d'armes deviennent apatrides dès qu'ils sont 2+ dans le Fer de Lance : ils doivent
  // apparaître partout pour qu'on puisse en réunir plusieurs (un frère isolé reste invalide).
  if (p.traits.includes(FRERE_D_ARMES)) return true;
  return Boolean(sealFor(cat, p));
}

/** Coût de recrutement affiché avant l'ajout : coût de carte, sceau imposé compris. */
export function recruitCost(cat: Catalog, p: Profile, factionId: string): number {
  return p.cost + (sealRequiredFor(cat, p, factionId)?.cost ?? 0);
}
