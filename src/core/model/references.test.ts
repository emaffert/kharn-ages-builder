import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { COLLECTION_OF, canRenameId, findReferences, idIsFree, parseCatalog, removeReferences, renameId, type Catalog, type RefKind } from "./index";

/**
 * Champs dont la valeur est une **étiquette libre**, jamais une référence à une entité, même quand
 * elle coïncide mot pour mot avec un identifiant :
 *
 * - `traits` / `trait` : des tags posés à la main (« fille-de-nyx » est un trait porté par quatre
 *   profils *et* l'identifiant d'une carte - renommer la carte ne doit pas toucher au trait) ;
 * - `logo` : un nom d'illustration que rien ne lit encore, égal par hasard à l'identifiant ;
 * - `kind` / `mountKinds` / les clés de `costByMountKind` : des valeurs d'énumération fixées par le
 *   schéma (« quagga » est la nature d'une monture *et* l'identifiant d'un type de monture).
 *
 * À l'inverse, les clés de `costByFaction` **sont** des références, et le renommage les suit.
 */
const FREE_LABELS = ["trait", "traits", "logo", "kind", "mountKinds", "costByMountKind"];

/**
 * Toute chaîne du catalogue égale à `id`, étiquettes libres mises à part - filet volontairement
 * plus large que le graphe, pour attraper une référence qu'on aurait oublié d'y déclarer.
 */
const occurrences = (cat: Catalog, id: string): number => {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).filter(([k]) => !FREE_LABELS.includes(k)).map(([k, v]) => [k, strip(v)]),
    );
  };
  return JSON.stringify(strip(cat)).split(`"${id}"`).length - 1;
};

describe("graphe de références", () => {
  it("retrouve qui cite un équipement de base", () => {
    const refs = findReferences(catalog, "equipment", "couteau");
    expect(refs.some((r) => r.owner === "profil « Goulue »" && r.where === "équipement de base")).toBe(true);
    expect(refs.length).toBeGreaterThan(5);
  });

  it("retrouve qui cite un profil, à travers cartes et réservations", () => {
    const refs = findReferences(catalog, "profile", "fangs-xayin-2");
    expect(refs.some((r) => r.owner.startsWith("carte"))).toBe(true);
    expect(refs.some((r) => r.owner.startsWith("équipement"))).toBe(true);
  });

  it("ne compte pas l'entité elle-même comme une référence", () => {
    // Les effets d'Alaric portent son propre identifiant dans leur `source`.
    const refs = findReferences(catalog, "profile", "gouns-alaric-1");
    expect(refs.some((r) => r.owner === "profil « Alaric »")).toBe(false);
  });

  it("ne trouve rien pour un identifiant inconnu", () => {
    expect(findReferences(catalog, "equipment", "objet-inexistant")).toEqual([]);
  });
});

describe("renommage en cascade", () => {
  it("emporte toutes les citations, et l'ancien identifiant disparaît du catalogue", () => {
    const next = renameId(catalog, "equipment", "couteau", "dague-de-ceinture");
    expect(occurrences(next, "couteau")).toBe(0);
    expect(next.equipment.some((e) => e.id === "dague-de-ceinture")).toBe(true);
    expect(next.profiles.find((p) => p.id === "fangs-goulue-1")!.baseEquipmentIds).toContain("dague-de-ceinture");
  });

  it("suit un profil jusque dans les cartes, les effets et les réservations", () => {
    const next = renameId(catalog, "profile", "fangs-xayin-2", "fangs-xayin-renomme");
    expect(occurrences(next, "fangs-xayin-2")).toBe(0);
  });

  // Le renommage de faction est interdit par l'interface (cf. FIXED_ID_KINDS), mais la fonction doit
  // rester correcte : c'est elle qui prouve que les clés d'objet sont bien suivies.
  it("suit une faction jusque dans les clés de « coût par faction »", () => {
    const withCost = catalog.equipment.find((e) => e.costByFaction != null)!;
    const faction = Object.keys(withCost.costByFaction!)[0];
    const next = renameId(catalog, "faction", faction, "faction-renommee");
    const after = next.equipment.find((e) => e.id === withCost.id)!;
    expect(Object.keys(after.costByFaction!)).toContain("faction-renommee");
    expect(occurrences(next, faction)).toBe(0);
  });

  it("laisse le catalogue valide après renommage", () => {
    const next = renameId(catalog, "skill", "riposte", "contre-attaque");
    expect(() => parseCatalog(next)).not.toThrow();
    expect(occurrences(next, "riposte")).toBe(0);
  });

  it("ne touche pas aux verbatims qui contiendraient le même mot", () => {
    // « lance » est un équipement ET un mot courant des textes de règles.
    const before = JSON.stringify(catalog).split("lance").length;
    const next = renameId(catalog, "equipment", "lance", "lance-de-cavalerie-2");
    expect(JSON.stringify(next).split("lance").length).toBe(before);
  });

  it("n'altère pas le catalogue d'origine", () => {
    const avant = JSON.stringify(catalog);
    renameId(catalog, "equipment", "couteau", "autre-chose");
    expect(JSON.stringify(catalog)).toBe(avant);
  });
});

describe("identifiants figés", () => {
  it("interdit de renommer un grimoire ou une faction, autorise le reste", () => {
    // « petit » / « grand » sont des valeurs d'énumération du schéma ; les factions portent
    // l'habillage du constructeur.
    expect(canRenameId("grimoire")).toBe(false);
    expect(canRenameId("faction")).toBe(false);
    expect(canRenameId("equipment")).toBe(true);
    expect(canRenameId("profile")).toBe(true);
  });
});

describe("unicité d'un identifiant", () => {
  it("refuse un identifiant déjà pris, accepte un libre", () => {
    expect(idIsFree(catalog, "equipment", "brigandine")).toBe(false);
    expect(idIsFree(catalog, "equipment", "identifiant-libre")).toBe(true);
  });
});

describe("couverture du graphe", () => {
  it("chaque type d'entité pointe vers une collection réellement présente", () => {
    for (const [kind, collection] of Object.entries(COLLECTION_OF)) {
      expect(Array.isArray(catalog[collection]), `${kind} → ${collection}`).toBe(true);
    }
  });

  it("renommer n'importe quelle entité du catalogue ne laisse jamais l'ancien identifiant", () => {
    // Un exemplaire par type : le graphe doit couvrir toutes les collections, pas seulement
    // celles auxquelles on a pensé en l'écrivant. On choisit un identifiant qui n'existe que dans
    // sa collection, sinon l'homonyme d'une autre collection fausserait le comptage.
    const seen = new Map<string, number>();
    for (const list of Object.values(catalog)) {
      if (!Array.isArray(list)) continue;
      for (const e of list as { id?: string }[]) if (e?.id) seen.set(e.id, (seen.get(e.id) ?? 0) + 1);
    }
    for (const kind of Object.keys(COLLECTION_OF) as RefKind[]) {
      if (!canRenameId(kind)) continue; // identifiants figés par le code
      const list = catalog[COLLECTION_OF[kind]] as unknown as { id: string }[];
      const entity = list.find((e) => seen.get(e.id) === 1);
      if (!entity) continue;
      const next = renameId(catalog, kind, entity.id, `${entity.id}-zzz`);
      expect(occurrences(next, entity.id), `${kind} : ${entity.id} subsiste`).toBe(0);
    }
  });

  it("ne confond pas deux entités homonymes de collections différentes", () => {
    // « osteomancie » est à la fois une compétence et une voie de magie : la voie est justement
    // maîtrisée par la compétence du même nom. Renommer l'une ne doit pas emporter l'autre.
    expect(catalog.skills.some((s) => s.id === "osteomancie")).toBe(true);
    expect(catalog.magicWays.some((w) => w.id === "osteomancie")).toBe(true);

    const wayRenamed = renameId(catalog, "magicWay", "osteomancie", "voie-osteomancie");
    expect(wayRenamed.skills.some((s) => s.id === "osteomancie")).toBe(true);
    expect(wayRenamed.spells.every((s) => s.magicWayId !== "osteomancie")).toBe(true);

    const skillRenamed = renameId(catalog, "skill", "osteomancie", "comp-osteomancie");
    expect(skillRenamed.magicWays.some((w) => w.id === "osteomancie")).toBe(true);
    expect(skillRenamed.magicWays.find((w) => w.id === "osteomancie")!.skillId).toBe("comp-osteomancie");
  });
});

describe("suppression des citations", () => {
  it("retire l'objet des équipements de base qui le portaient", () => {
    const next = removeReferences(catalog, "equipment", "couteau");
    expect(next.profiles.find((p) => p.id === "fangs-goulue-1")!.baseEquipmentIds).not.toContain("couteau");
    expect(findReferences(next, "equipment", "couteau")).toEqual([]);
  });

  it("emporte la compétence de profil, qui n'existe pas sans sa compétence", () => {
    const porteur = catalog.profiles.find((p) => p.skills.some((s) => s.skillId === "riposte"))!;
    const next = removeReferences(catalog, "skill", "riposte");
    const apres = next.profiles.find((p) => p.id === porteur.id)!;
    expect(apres.skills.some((s) => s.skillId === "riposte")).toBe(false);
    expect(apres.skills.length).toBe(porteur.skills.length - 1);
  });

  it("vide une référence facultative au lieu d'emporter son objet", () => {
    // Le groupe d'un profil est facultatif : le profil survit sans lui.
    const profil = catalog.profiles.find((p) => p.modelId != null)!;
    const next = removeReferences(catalog, "model", profil.modelId!);
    const apres = next.profiles.find((p) => p.id === profil.id)!;
    expect(apres).toBeDefined();
    expect(apres.modelId).toBeUndefined();
  });

  it("emporte l'effet dont l'opération citait le sort supprimé", () => {
    const next = removeReferences(catalog, "spell", "lien-mental");
    const alaric = next.profiles.find((p) => p.id === "gouns-alaric-1")!;
    expect((alaric.effects ?? []).some((e) => e.operation.kind === "grant-spell")).toBe(false);
  });

  it("n'altère pas le catalogue d'origine", () => {
    const avant = JSON.stringify(catalog);
    removeReferences(catalog, "equipment", "couteau");
    expect(JSON.stringify(catalog)).toBe(avant);
  });

  it("laisse un catalogue valide et sans citation résiduelle, pour chaque type", () => {
    for (const kind of Object.keys(COLLECTION_OF) as RefKind[]) {
      const list = catalog[COLLECTION_OF[kind]] as unknown as { id: string }[];
      // On choisit une entité réellement citée : c'est le cas qui peut casser.
      const entity = list.find((e) => findReferences(catalog, kind, e.id).length > 0);
      if (!entity) continue;
      const next = removeReferences(catalog, kind, entity.id);
      expect(findReferences(next, kind, entity.id), `${kind} : citations résiduelles`).toEqual([]);
      expect(() => parseCatalog(next), `${kind} : catalogue invalide`).not.toThrow();
    }
  });
});
