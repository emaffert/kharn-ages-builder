import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { innateSpellIds, isDuplicable, pageBonusSources, wornArmorsFrom } from "./shared";

/**
 * Armure de Combat Khârne (équipement `eq-armure-combat-kharne`, `heavySeuil` 5) : le seuil de réussite
 * baisse à 5 si le porteur possède déjà une armure innée au moins aussi protectrice (échec ≤ -1 ET réussite ≤ -3).
 */
describe("wornArmorsFrom - heavySeuil conditionnel", () => {
  const combatSeuil = (innate?: { protectionEchec?: number; protectionReussite?: number }) =>
    wornArmorsFrom(catalog, ["eq-armure-combat-kharne"], undefined, innate)[0]?.seuil;

  it("porteur déjà lourd (Paladin -1/7/-3) → seuil 5", () => {
    expect(combatSeuil({ protectionEchec: -1, protectionReussite: -3 })).toBe(5);
  });

  it("porteur léger (Guerrier 0/6/-1) → seuil de base 7", () => {
    expect(combatSeuil({ protectionEchec: 0, protectionReussite: -1 })).toBe(7);
  });

  it("Engueran (-1/6/-3, protections déjà lourdes) → seuil 5", () => {
    expect(combatSeuil({ protectionEchec: -1, protectionReussite: -3 })).toBe(5);
  });

  it("sans armure innée connue → seuil de base 7", () => {
    expect(combatSeuil(undefined)).toBe(7);
  });

  it("une armure sans heavySeuil (Brigandine) garde son seuil, même sur porteur lourd", () => {
    const brig = wornArmorsFrom(catalog, ["brigandine"], undefined, {
      protectionEchec: -1,
      protectionReussite: -3,
    })[0];
    expect(brig?.seuil).toBe(catalog.equipment.find((e) => e.id === "brigandine")?.seuil);
  });
});

/**
 * Sorts d'office et pages de sorts sont résolus hors du pipeline du moteur, pour rester calculables
 * sur une fiche isolée. Ils doivent donc reconnaître les trois porteurs possibles - profil, carte
 * qui vise la figurine, objet porté - sans quoi l'effet disparaît selon l'endroit où on le pose.
 */
describe("effets portés par une figurine (hors contexte de liste)", () => {
  const alaric = catalog.profiles.find((p) => p.id === "gouns-alaric-1")!;
  const meneuse = catalog.profiles.find((p) => p.id === "fangs-meneuse-1")!;

  it("reconnaît un sort d'office porté par le profil (Alaric → Lien Mental)", () => {
    expect(innateSpellIds(alaric, catalog, [])).toContain("lien-mental");
  });

  it("reconnaît un sort d'office porté par un objet équipé", () => {
    // Le catalogue n'en contient pas encore : on le simule sur un objet réel du catalogue.
    const eq = catalog.equipment.find((e) => e.id === "faucille-os")!;
    const cat = {
      ...catalog,
      equipment: catalog.equipment.map((e) =>
        e.id !== eq.id
          ? e
          : {
              ...e,
              effects: [
                {
                  id: "test-innate",
                  source: { kind: "equipment" as const, id: eq.id },
                  scope: "fer-de-lance" as const,
                  target: { self: true },
                  operation: { kind: "grant-spell" as const, spellId: "lien-mental" },
                  sourceText: "",
                },
              ],
            },
      ),
    };
    expect(innateSpellIds(meneuse, cat, [], [eq.id])).toContain("lien-mental");
    // Sans l'objet sur elle, rien.
    expect(innateSpellIds(meneuse, cat, [], [])).not.toContain("lien-mental");
  });

  it("compte les pages d'un objet porté (Brassards d'Euthéria : 2 pools dédiés de 5)", () => {
    const pools = pageBonusSources(meneuse, catalog, [], ["brassards-eutheria"]).filter((s) => s.magicWayId);
    expect(pools.map((s) => s.amount)).toEqual([5, 5]);
    expect(new Set(pools.map((s) => s.magicWayId)).size).toBe(2);
    // Sans les brassards au bras, aucun pool dédié.
    expect(pageBonusSources(meneuse, catalog, [], []).filter((s) => s.magicWayId)).toEqual([]);
  });

  it("compte les pages d'une carte qui vise la figurine (Fille de Nyx : +3)", () => {
    const nyx = catalog.profiles.find((p) => p.traits.includes("fille-de-nyx"))!;
    const general = pageBonusSources(nyx, catalog, [], []).filter((s) => !s.magicWayId);
    expect(general.some((s) => s.name === "Fille de Nyx" && s.amount === 3)).toBe(true);
  });
});

/**
 * Une armure ordinaire achetée remplace l'armure innée ; le Gambison et les objets qui protègent sans
 * être des armures (Vouge de Moringa) s'y ajoutent. La fiche peut donc porter plusieurs lignes.
 */
describe("wornArmorsFrom - cumul des protections", () => {
  const VOUGE = "equip-1785436448046";
  const innate = { protectionEchec: 0, seuil: 6, protectionReussite: -1, durability: 6 };
  const labels = (ids: string[]) => wornArmorsFrom(catalog, ids, undefined, innate).map((a) => a.label);

  it("sans rien de porté, l'armure innée est la seule ligne", () => {
    expect(labels([])).toEqual(["🛡 Armure"]);
  });

  it("une armure ordinaire remplace l'innée", () => {
    expect(labels(["cotte-de-maille"])).toEqual(["🛡 Cotte de maille"]);
  });

  it("un gambison s'ajoute à l'armure innée", () => {
    expect(labels(["gambison"])).toEqual(["🛡 Armure", "🛡 Gambison"]);
  });

  it("armure + gambison + vouge : trois lignes, dans cet ordre", () => {
    expect(labels(["cotte-de-maille", "gambison", VOUGE])).toEqual([
      "🛡 Cotte de maille",
      "🛡 Gambison",
      "🛡 Vouge de Moringa",
    ]);
  });

  it("la vouge porte bien ses valeurs de protection", () => {
    const vouge = wornArmorsFrom(catalog, [VOUGE])[0];
    expect(vouge).toMatchObject({ protectionEchec: -1, seuil: 5, protectionReussite: -2, durability: 10 });
  });

  it("un objet sans valeurs de protection n'ajoute aucune ligne", () => {
    expect(labels(["faucille-os"])).toEqual(["🛡 Armure"]);
  });
});

/**
 * Bouton « dupliquer » : masqué là où un second exemplaire n'existera jamais, affiché partout
 * ailleurs (il se grise sur la limitation atteinte, ce que gère `atLimit` côté écran).
 */
describe("isDuplicable", () => {
  const profile = (id: string) => catalog.profiles.find((p) => p.id === id)!;

  it("un profil à limitation X est duplicable", () => {
    expect(isDuplicable(profile("fangs-larbin-1"))).toBe(true); // LIM 5
    expect(isDuplicable(profile("fangs-goulue-1"))).toBe(true); // LIM 4
  });

  it("un profil unique (U) ou un personnage (P) ne l'est pas", () => {
    expect(isDuplicable(profile("fangs-executeur-3"))).toBe(false); // U
    expect(isDuplicable(profile("fangs-apathee-3"))).toBe(false); // P
  });

  it("aucun profil unique du catalogue n'échappe à la règle", () => {
    const fautifs = catalog.profiles.filter(
      (p) => isDuplicable(p) && (p.limitation.kind === "U" || p.limitation.kind === "P"),
    );
    expect(fautifs).toEqual([]);
  });
});
