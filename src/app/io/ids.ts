/**
 * Générateurs d'identifiants locaux (listes, instances). Un compteur suffixe l'horodatage
 * pour rester unique même si plusieurs ids sont générés dans la même milliseconde.
 */

let listCounter = 0;
export const newListId = () => `list-${Date.now().toString(36)}-${listCounter++}`;

let instanceCounter = 0;
export const newInstanceId = (profileId: string) =>
  `${profileId}#${Date.now().toString(36)}-${instanceCounter++}`;
