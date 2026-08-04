import type { Profile } from "../model";

/**
 * **Peuple d'origine** d'une figurine.
 *
 * Les factions « creuset » (Guilde Noire, Affranchis) rassemblent des transfuges des autres peuples.
 * L'origine se lit sur `profile.origin`, avec pour défaut la faction du profil : une figurine
 * ordinaire est originaire de son propre peuple, il n'y a donc rien à saisir hors des creusets.
 *
 * Ce que l'origine emporte, elle l'emporte **explicitement**, jamais par déduction générale :
 *
 * - la **monture** du peuple d'origine (`isMountEligible`), pour les deux creusets ;
 * - la **nature** carnivore / herbivore chez les Affranchis seulement (« ils respectent leur nature
 *   profonde d'herbivore ou de carnivore sans restrictions », p.47) - mais **pas** à la Guilde
 *   Noire, dont la FAQ dit que les figurines « ne sont pas intrinsèquement représentantes de leur
 *   espèce d'origine ». Il n'y a donc pas de fonction qui déduirait la nature de l'origine : elle
 *   se pose à l'import, en compétence sur la fiche, d'après `faction.nature` du peuple d'origine.
 *
 * Rien d'autre ne suit le transfuge : ni objets, ni sorts, ni compétences réservés.
 */

/** Faction d'origine (défaut : la faction du profil). `undefined` pour un profil sans logo. */
export function originFactionId(profile: Profile): string | undefined {
  return profile.origin ?? profile.factionId;
}

/**
 * Origine **de cette figurine-là**. Quand la carte laisse le choix (`originChoices`), c'est le
 * joueur qui tranche au recrutement et la réponse varie d'un exemplaire à l'autre : deux Agents
 * sombres d'un même Fer de Lance peuvent venir de deux peuples et n'avoir pas les mêmes montures.
 *
 * Le choix n'est retenu que s'il figure dans la liste proposée : une liste importée ou modifiée à la
 * main ne doit pas ouvrir une monture par une origine que la carte n'offre pas.
 */
export function effectiveOrigin(
  profile: Profile,
  instance?: { origin?: string },
): string | undefined {
  const choices = profile.originChoices;
  if (choices?.length) {
    return instance?.origin && choices.includes(instance.origin) ? instance.origin : undefined;
  }
  return originFactionId(profile);
}

/** La figurine doit-elle se voir attribuer une origine au recrutement ? */
export function needsOriginChoice(profile: Profile): boolean {
  return (profile.originChoices?.length ?? 0) > 0;
}
