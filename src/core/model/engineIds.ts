import type { RefKind } from "./references";

/**
 * Identifiants que le **moteur lit en dur**, et qui sont donc des constantes du code autant que des
 * données.
 *
 * Une compétence ordinaire ne vaut que par ce que le catalogue en dit ; celles-ci commandent en plus
 * un comportement écrit en TypeScript, qui les cherche par leur identifiant exact. Les renommer
 * depuis l'administration ne casserait rien de visible - aucune référence ne pointerait dans le vide,
 * la cascade ferait son travail - mais le moteur cesserait silencieusement de les reconnaître : plus
 * d'apatride recrutable partout, plus d'archimage, plus de berserk privé de monture.
 *
 * Elles vivent ici, dans le modèle, et non auprès du code qui les consomme : le graphe de références
 * (`references.ts`) doit pouvoir les consulter pour verrouiller leur renommage, et il ne peut pas
 * dépendre du moteur.
 */
export interface EngineId {
  kind: RefKind;
  id: string;
  /** Ce que le moteur en fait, pour l'expliquer à qui essaie de renommer. */
  why: string;
}

export const ENGINE_IDS: readonly EngineId[] = [
  { kind: "skill", id: "apatride", why: "recrutable dans n'importe quelle faction" },
  { kind: "skill", id: "archimage", why: "maîtrise toutes les écoles de magie" },
  { kind: "skill", id: "affinite", why: "ouvre au grimoire les sorts d'une école supplémentaire" },
  { kind: "skill", id: "seigneur-de-guerre", why: "plafond d'esclaves d'un Fer de Lance" },
  { kind: "skill", id: "berserk", why: "interdit toute monture à son porteur" },
];

/** Le moteur lit-il cet identifiant en dur ? Si oui, il n'est pas renommable. */
export function engineId(kind: RefKind, id: string): EngineId | undefined {
  return ENGINE_IDS.find((e) => e.kind === kind && e.id === id);
}

/**
 * L'identifiant d'une compétence lue en dur, repris depuis la table ci-dessus plutôt que réécrit
 * dans le moteur : une seule source, et une erreur de frappe côté moteur devient impossible.
 */
export function engineIdOf(id: (typeof ENGINE_IDS)[number]["id"]): string {
  const found = ENGINE_IDS.find((e) => e.id === id);
  if (!found) throw new Error(`Identifiant moteur inconnu : ${id}`);
  return found.id;
}
