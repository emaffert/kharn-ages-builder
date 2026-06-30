/**
 * Modèle du catalogue (lecture seule, versionné).
 *
 * Référence : docs/schema-donnees.md — couche 1.
 * Les types ci-dessous seront complétés et validés par des schémas Zod
 * au fur et à mesure de la transcription des cartes.
 */

export interface Faction {
  id: string;
  name: string;
  logo: string;
  subFactions?: string[];
  notes?: string;
}
