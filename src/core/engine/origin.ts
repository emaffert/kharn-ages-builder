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
