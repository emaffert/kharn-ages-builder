import type { Catalog, Equipment, OpenRecruitment, Profile } from "../model";
import { isSlaveIn } from "./slavery";

/**
 * Voies d'accès d'un profil à un Fer de Lance d'une autre faction, partagées par le moteur
 * (validation) et le constructeur (roster, coûts, verrouillage du sceau).
 *
 * Cinq voies existent : la compétence `apatride` (recrutable partout), la contrainte
 * `faction-membership` (« Allié des X »), le **sceau** - un objet qui octroie `apatride` à son
 * porteur (« Sceau de la guilde noire », +10 Ko, FAQ Janv. 2026 + carte p. 79) -, la condition
 * d'**esclave**, qui fait entrer la figurine par un Seigneur de guerre (cf. `slavery.ts`), et le
 * **recrutement ouvert**, déclaré par la faction d'accueil (les Affranchis, cf.
 * `openRecruitmentAccepts`).
 */

/**
 * Compétence « Apatride » : recrutable dans le fer-de-lance de n'importe quelle faction. Une seule
 * écriture, celle de la carte : les octrois (sceau, carte « Frères d'Armes ») passent eux aussi par
 * `grant-skill`. Aucun trait homonyme n'est lu.
 */
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

/**
 * Une figurine peut-elle porter cet équipement **dans ce Fer de Lance** ?
 *
 * S'ajoute à la réservation ordinaire la règle du transfuge (règles p.47) : « ayant fui leur peuple
 * d'origine, ils ont de fait perdu l'accès à l'arsenal qui le caractérisait ». Une figurine entrée
 * par le recrutement ouvert ne peut donc pas porter un objet **réservé à une faction**, sauf s'il
 * l'est à sa faction d'accueil. Les autres réservations (profil, modèle, trait, niveau) ne sont pas
 * touchées : le Guerrier khârn garde son arme de signature.
 */
export function equipmentAllowedIn(
  cat: Catalog,
  eq: Equipment,
  p: Profile,
  factionId: string,
): boolean {
  if (!equipmentReservedOk(eq, p)) return false;
  const reservedFactions = eq.reservedTo?.factionIds;
  if (!reservedFactions || !openRecruitmentAccepts(cat, p, factionId)) return true;
  return reservedFactions.includes(factionId);
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
 * La figurine est-elle apatride ? La compétence de sa carte suffit ; s'y ajoutent les compétences
 * octroyées par effet (`grantedSkillIds` : sceau porté, carte « Frères d'Armes » à partir de deux).
 * Sans contexte de liste, seule la carte compte.
 */
export function isApatride(p: Profile, grantedSkillIds: readonly string[] = []): boolean {
  return p.skills.some((s) => s.skillId === APATRIDE) || grantedSkillIds.includes(APATRIDE);
}

/**
 * Un **générique** est une figurine ni unique ni personnage : c'est la limitation numérique de la
 * carte qui le dit (« Limitation 2 »), les deux autres formes étant « U » et « P ». Notion employée
 * par le recrutement ouvert, qui accueille les génériques d'autres peuples et rien d'autre.
 */
export function isGeneric(p: Profile): boolean {
  return p.limitation.kind === "X";
}

/** La règle de recrutement ouvert de cette faction, si elle concerne le peuple de ce profil. */
function openRuleFor(cat: Catalog, p: Profile, factionId: string): OpenRecruitment | undefined {
  const open = cat.factions.find((f) => f.id === factionId)?.openRecruitment;
  return open && p.factionId && open.fromFactionIds.includes(p.factionId) ? open : undefined;
}

/**
 * Le **recrutement ouvert** de la faction d'accueil accepte-t-il ce profil ? Règle des Affranchis
 * (p.46) : n'importe quel générique des peuples listés, sauf exclusions nommées ou par trait.
 *
 * Les plafonds par Fer de Lance (« pas plus d'un shaman goûn ») ne se jugent pas ici : ils portent
 * sur une composition, pas sur une figurine, et sont vérifiés par `validateOpenRecruitmentCaps`.
 */
export function openRecruitmentAccepts(cat: Catalog, p: Profile, factionId: string): boolean {
  const open = openRuleFor(cat, p, factionId);
  if (!open || !isGeneric(p)) return false;
  if (open.excludeProfileIds?.includes(p.id)) return false;
  return !open.excludeTraits?.some((t) => p.traits.includes(t));
}

/**
 * La faction d'accueil **refuse-t-elle** ce profil ?
 *
 * Pour les peuples qu'elle nomme, la règle est **exhaustive** : elle dit qui peut venir, donc elle
 * dit aussi qui ne le peut pas (« seuls les génériques non uniques […] sont tolérés pour la Guilde
 * Noire »). Le refus est alors un veto, qui bat toutes les autres voies d'accès. Sans lui, la
 * figurine qu'on vient d'écarter rentrerait par la porte de derrière : l'Agent sombre III, unique,
 * arrivait chez les Affranchis en payant son sceau de la Guilde Noire.
 *
 * Les peuples que la faction ne nomme pas ne sont pas concernés : un Tembo apatride garde sa porte,
 * comme les règles le prévoient explicitement.
 */
export function openRecruitmentRefuses(cat: Catalog, p: Profile, factionId: string): boolean {
  return Boolean(openRuleFor(cat, p, factionId)) && !openRecruitmentAccepts(cat, p, factionId);
}

/**
 * Le profil est-il recrutable dans ce Fer de Lance **sans rien payer ni réunir** ? Même faction,
 * profil sans logo, `apatride` imprimé sur la carte, « Allié des X », ou recrutement ouvert de la
 * faction d'accueil. Les octrois (carte « Frères d'Armes », sceau) ne comptent pas ici : ils
 * dépendent de la liste ou d'un achat.
 */
export function recruitableWithoutSeal(cat: Catalog, p: Profile, factionId: string): boolean {
  if (!p.factionId || p.factionId === factionId) return true;
  // Ce que la CARTE accorde nommément passe avant la règle générale du peuple : le Bourgmestre est
  // « Allié des Affranchis », il entre malgré son statut de personnage.
  if (isApatride(p)) return true;
  if (alliedFactions(p).includes(factionId)) return true;
  if (openRecruitmentRefuses(cat, p, factionId)) return false; // veto : plus aucune autre voie
  return openRecruitmentAccepts(cat, p, factionId);
}

/**
 * Le « sceau » accessible à ce profil : un équipement qui octroie la compétence `apatride` à son
 * porteur et dont la réservation l'accepte. Aucun identifiant n'est codé en dur - la règle vient du
 * catalogue.
 */
export function sealFor(cat: Catalog, p: Profile): Equipment | undefined {
  return cat.equipment.find(
    (e) =>
      equipmentReservedOk(e, p) &&
      (e.effects ?? []).some(
        (ef) =>
          ef.target.self && ef.operation.kind === "grant-skill" && ef.operation.skillId === APATRIDE,
      ),
  );
}

/** Sceau **proposé à l'achat** dans ce Fer de Lance : le profil n'y est pas recrutable autrement. */
export function sealOfferedFor(cat: Catalog, p: Profile, factionId: string): Equipment | undefined {
  return recruitableWithoutSeal(cat, p, factionId) ? undefined : sealFor(cat, p);
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
  if (recruitableWithoutSeal(cat, p, factionId)) return true;
  // Refusé par la faction d'accueil : ni le sceau, ni l'asservissement, ni un second frère d'armes
  // ne rouvrent la porte.
  if (openRecruitmentRefuses(cat, p, factionId)) return false;
  // Une esclave figure au roster de la faction qui peut l'asservir, en « recrutement conditionnel » :
  // elle ne s'y achète pas directement, elle se recrute depuis un Seigneur de guerre.
  if (isSlaveIn(p, factionId)) return true;
  // Les frères d'armes deviennent apatrides dès qu'ils sont 2+ dans le Fer de Lance : ils doivent
  // apparaître partout pour qu'on puisse en réunir plusieurs (un frère isolé reste invalide).
  if (p.traits.includes(FRERE_D_ARMES)) return true;
  return Boolean(sealFor(cat, p));
}

/** Coût de recrutement affiché avant l'ajout : coût de carte, sceau imposé compris. */
export function recruitCost(cat: Catalog, p: Profile, factionId: string): number {
  return p.cost + (sealRequiredFor(cat, p, factionId)?.cost ?? 0);
}
