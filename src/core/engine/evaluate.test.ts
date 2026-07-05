import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import type { ListDocument, ProfileInstance } from "../model";
import { evaluateList } from "./evaluate";

let counter = 0;
function inst(profileId: string, over: Partial<ProfileInstance> = {}): ProfileInstance {
  counter += 1;
  return {
    instanceId: `${profileId}#${counter}`,
    profileId,
    addedEquipmentIds: [],
    removedBaseEquipmentIds: [],
    spellIds: [],
    ...over,
  };
}

function makeList(
  members: ProfileInstance[],
  factionId = "fangs",
  format: "escarmouche" | "bataille" = "escarmouche",
): ListDocument {
  return {
    schemaVersion: "1",
    catalogVersion: catalog.version,
    id: "test",
    name: "Test",
    format,
    createdAt: "2026-06-30T00:00:00Z",
    updatedAt: "2026-06-30T00:00:00Z",
    fersDeLance: [
      { id: "fdl1", factionId, leaderInstanceId: members[0]?.instanceId ?? "", members },
    ],
    snapshot: { totalCost: 0, entries: [] },
  };
}

const evalFang = (members: ProfileInstance[], faction?: string) =>
  evaluateList(catalog, makeList(members, faction));

describe("calcul de coût", () => {
  it("coût de base d'un profil", () => {
    const res = evalFang([inst("fangs-goulue-1")]);
    expect(res.totalCost).toBe(45);
    expect(res.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("une Fille de Nyx rend gratuit le Larbin *désigné* garde du corps", () => {
    const apathee = inst("fangs-apathee-3");
    const larbins = [
      inst("fangs-larbin-1", { bodyguardOfInstanceId: apathee.instanceId }),
      inst("fangs-larbin-1"),
      inst("fangs-larbin-1"),
    ];
    const res = evalFang([apathee, ...larbins]);
    // 140 (Apathée) + 1 Larbin désigné à 0 + 2 Larbins à 35 = 210
    expect(res.totalCost).toBe(210);
    expect(Object.values(res.costByInstance).filter((c) => c === 0)).toHaveLength(1);
  });

  it("un Larbin non désigné n'est pas gratuit", () => {
    const res = evalFang([inst("fangs-apathee-3"), inst("fangs-larbin-1")]);
    expect(Object.values(res.costByInstance).some((c) => c === 0)).toBe(false);
  });

  it("un Larbin désigné garde d'une non-Fille de Nyx n'est pas gratuit (designation.of)", () => {
    // Une Fille (Apathée) est présente donc l'effet existe, mais le Larbin est assigné à une Goulue
    // qui n'a pas le trait « fille-de-nyx » → la remise ne s'applique pas.
    const goulue = inst("fangs-goulue-1");
    const larbin = inst("fangs-larbin-1", { bodyguardOfInstanceId: goulue.instanceId });
    const res = evalFang([inst("fangs-apathee-3"), goulue, larbin]);
    expect(res.costByInstance[larbin.instanceId]).toBe(35);
  });

  it("deux Filles de Nyx rendent gratuits 2 Larbins désignés (plafond)", () => {
    const apathee = inst("fangs-apathee-3");
    const broutcha = inst("fangs-broutcha-2");
    const larbins = [
      inst("fangs-larbin-1", { bodyguardOfInstanceId: apathee.instanceId }),
      inst("fangs-larbin-1", { bodyguardOfInstanceId: broutcha.instanceId }),
      inst("fangs-larbin-1", { bodyguardOfInstanceId: apathee.instanceId }),
    ];
    const res = evalFang([apathee, broutcha, ...larbins]);
    // 2 gratuits (plafond), le 3e désigné reste à 35
    expect(Object.values(res.costByInstance).filter((c) => c === 0)).toHaveLength(2);
    // 140 + 120 + 0 + 0 + 35 = 295
    expect(res.totalCost).toBe(295);
  });

  it("La réduction « garde rapproché » de Djouked s'applique seulement s'il est désigné (Broutcha présente)", () => {
    const djoukedCost = (l: ReturnType<typeof evalFang>) =>
      Object.entries(l.costByInstance).find(([id]) => id.startsWith("fangs-djouked-2"))![1];
    // Non désigné → plein tarif même avec Broutcha.
    expect(djoukedCost(evalFang([inst("fangs-djouked-2"), inst("fangs-broutcha-2")]))).toBe(90);
    // Désigné garde du corps de Broutcha → −35.
    const broutcha = inst("fangs-broutcha-2");
    expect(
      djoukedCost(evalFang([inst("fangs-djouked-2", { bodyguardOfInstanceId: broutcha.instanceId }), broutcha])),
    ).toBe(55);
    // Désigné mais sans Broutcha → la condition n'est pas remplie, plein tarif.
    expect(djoukedCost(evalFang([inst("fangs-djouked-2", { bodyguardOfInstanceId: "x" })]))).toBe(90);
  });

  it("Exécuteur II paye 10 de moins son arbalète de poing", () => {
    const res = evalFang([inst("fangs-executeur-2", { addedEquipmentIds: ["arbalete-de-poing"] })]);
    // 80 (Exécuteur II) + 0 (arbalète) - 10 (arme de prédilection) = 70
    expect(res.totalCost).toBe(70);
  });
});

describe("validation des contraintes", () => {
  it("Muskh sans Xayìn est invalide", () => {
    const res = evalFang([inst("fangs-muskh-1")]);
    expect(res.issues.some((i) => i.ruleId === "muskh-requires-xayin")).toBe(true);
  });

  it("Muskh avec Xayìn est valide", () => {
    const res = evalFang([inst("fangs-muskh-1"), inst("fangs-xayin-2")]);
    expect(res.issues.some((i) => i.ruleId === "muskh-requires-xayin")).toBe(false);
  });

  it("Larbin équipé d'une arme est invalide (Éprouvé)", () => {
    const res = evalFang([inst("fangs-larbin-1", { addedEquipmentIds: ["couteau"] })]);
    expect(res.issues.some((i) => i.ruleId === "larbin-eprouve")).toBe(true);
  });

  it("Likan équipé est invalide (aliéné : pas d'ajout d'équipement)", () => {
    const res = evalFang([inst("fangs-likan-1", { addedEquipmentIds: ["couteau"] })]);
    expect(res.issues.some((i) => i.ruleId === "likan-no-equipment")).toBe(true);
  });

  it("respecte la limitation de recrutement (Goulue I, Lim 4)", () => {
    const four = evalFang(Array.from({ length: 4 }, () => inst("fangs-goulue-1")));
    expect(four.issues.some((i) => i.ruleId?.startsWith("limitation:"))).toBe(false);

    const five = evalFang(Array.from({ length: 5 }, () => inst("fangs-goulue-1")));
    expect(five.issues.some((i) => i.ruleId?.startsWith("limitation:"))).toBe(true);
  });

  it("Likan : somme des niveaux des rattachés ≤ niveau du porteur", () => {
    const likanA = inst("fangs-likan-1");
    const ok = evalFang([
      inst("fangs-goulue-1", { attachedInstanceIds: [likanA.instanceId] }),
      likanA,
    ]);
    expect(ok.issues.some((i) => i.ruleId === "likan-attachment")).toBe(false);

    const l1 = inst("fangs-likan-1");
    const l2 = inst("fangs-likan-1");
    const tooMany = evalFang([
      inst("fangs-goulue-1", { attachedInstanceIds: [l1.instanceId, l2.instanceId] }),
      l1,
      l2,
    ]);
    expect(tooMany.issues.some((i) => i.ruleId === "likan-attachment")).toBe(true);
  });

});

describe("caractéristique dérivée d'un décompte (stat-count)", () => {
  it("Instinct grégaire : la Témérité d'un Dogon = nombre de Dogons", () => {
    const dogons = [inst("gouns-dogon-1"), inst("gouns-dogon-1"), inst("gouns-dogon-1")];
    const res = evaluateList(catalog, makeList(dogons, "gouns"));
    for (const d of dogons) expect(res.statDeltas[d.instanceId]?.t).toBe(3); // T de base (—) → 3
  });

  it("Instinct grégaire avec minimum : T = max(nombre de Mongos, T de base)", () => {
    const m2 = inst("gouns-guerrier-mongo-2"); // T de base 3
    // Seul (1 Mongo) : sous le minimum → T reste 3 (delta 0).
    const solo = evaluateList(catalog, makeList([m2], "gouns"));
    expect(solo.statDeltas[m2.instanceId]?.t ?? 0).toBe(0);
    // 5 Mongos : dépasse le minimum → T = 5 (delta +2 sur la base 3).
    const m2b = inst("gouns-guerrier-mongo-2");
    const crowd = evaluateList(
      catalog,
      makeList([m2b, ...Array.from({ length: 4 }, () => inst("gouns-guerrier-mongo-1"))], "gouns"),
    );
    expect(crowd.statDeltas[m2b.instanceId]?.t).toBe(2);
  });

  it("Artisane : Témérité = nombre de Goüns niveau I (faction ET niveau, dimensions cumulées)", () => {
    const artisane = inst("gouns-artisane-dogon-1"); // niveau I
    // 1 Artisane (I) + 1 Dogon (I) = 2 Goüns niveau I ; le Guerrier albinos III (niveau III) ne compte pas.
    const res = evaluateList(
      catalog,
      makeList([artisane, inst("gouns-dogon-1"), inst("gouns-guerrier-albinos-3")], "gouns"),
    );
    expect(res.statDeltas[artisane.instanceId]?.t).toBe(2);
  });
});

describe("valeur de compétence dérivée d'un décompte (skill-count)", () => {
  it("Seigneur de guerre = ⌊ nombre de Niv I de l'Ost / 3 ⌋", () => {
    const vieillard = inst("gouns-vieillard-shaman-3"); // Niv III : ne se compte pas lui-même
    // 7 figurines Niveau I → ⌊7/3⌋ = 2.
    const nivI = Array.from({ length: 7 }, () => inst("gouns-dogon-1"));
    const res = evaluateList(catalog, makeList([vieillard, ...nivI], "gouns"));
    expect(res.skillValues[vieillard.instanceId]?.["seigneur-de-guerre"]).toBe(2);
  });

  it("arrondi inférieur : 2 Niv I → 0", () => {
    const vieillard = inst("gouns-vieillard-shaman-3");
    const res = evaluateList(catalog, makeList([vieillard, inst("gouns-dogon-1"), inst("gouns-dogon-1")], "gouns"));
    expect(res.skillValues[vieillard.instanceId]?.["seigneur-de-guerre"]).toBe(0);
  });
});

describe("amélioration partagée (payée une fois par Fer de Lance)", () => {
  it("Lien de la Terre n'est facturée qu'une fois même portée par plusieurs Dogons", () => {
    const plain = evaluateList(catalog, makeList([inst("gouns-dogon-1"), inst("gouns-dogon-1")], "gouns")).totalCost;
    const shared = evaluateList(
      catalog,
      makeList(
        [
          inst("gouns-dogon-1", { specialCardIds: ["lien-de-la-terre"] }),
          inst("gouns-dogon-1", { specialCardIds: ["lien-de-la-terre"] }),
        ],
        "gouns",
      ),
    ).totalCost;
    expect(shared - plain).toBe(8); // +8 une seule fois, pas +16
  });

  it("Lien de la Terre octroie « Héroïque défense » à tous les Dogons (≥3 Dogons + Père de famille)", () => {
    const d1 = inst("gouns-dogon-1", { specialCardIds: ["lien-de-la-terre"] });
    const d2 = inst("gouns-dogon-1"); // ne porte pas la carte mais en bénéficie
    const d3 = inst("gouns-dogon-1");
    const pere = inst("gouns-pere-de-famille-2");
    const res = evaluateList(catalog, makeList([d1, d2, d3, pere], "gouns"));
    const heroique = res.grantedSkills[d2.instanceId]?.find((g) => g.skillId === "heroique");
    expect(heroique?.value).toBe("défense");
    expect(res.grantedSkills[d2.instanceId]?.map((g) => g.skillId)).toContain("instinct-de-survie");
  });
});

describe("munitions", () => {
  it("les munitions ajoutent quantité × coût unitaire au coût", () => {
    const base = evalFang([inst("fangs-executeur-1", { addedEquipmentIds: ["arbalete-de-poing"] })]).totalCost;
    const withMun = evalFang([
      inst("fangs-executeur-1", {
        addedEquipmentIds: ["arbalete-de-poing"],
        munitions: { "arbalete-de-poing": 3 },
      }),
    ]).totalCost;
    expect(withMun - base).toBe(6); // 3 × 2 Ko
  });
});

describe("validation magie & emplacements", () => {
  it("sorts sélectionnés sans lanceur → invalide", () => {
    const res = evalFang([inst("fangs-larbin-1", { spellIds: ["seduction-du-fiel"] })]);
    expect(res.issues.some((i) => i.ruleId === "spells-no-caster")).toBe(true);
  });

  it("capacité de pages dépassée → invalide (Apathée : +3 pages, 2 sorts = 4)", () => {
    const over = evalFang([
      inst("fangs-apathee-3", { spellIds: ["seduction-du-fiel", "inflection-mentale"] }),
    ]);
    expect(over.issues.some((i) => i.ruleId === "pages-over-capacity")).toBe(true);

    const ok = evalFang([inst("fangs-apathee-3", { spellIds: ["seduction-du-fiel"] })]);
    expect(ok.issues.some((i) => i.ruleId === "pages-over-capacity")).toBe(false);
  });

  it("grimoire interdit (Meneuse Novice : pas de grand grimoire)", () => {
    const grand = evalFang([inst("fangs-meneuse-1", { grimoireId: "grand" })]);
    expect(grand.issues.some((i) => i.ruleId === "grimoire-forbidden")).toBe(true);

    const petit = evalFang([inst("fangs-meneuse-1", { grimoireId: "petit" })]);
    expect(petit.issues.some((i) => i.ruleId === "grimoire-forbidden")).toBe(false);
  });

  it("trop d'équipement à mains → invalide (couteau + 2 armes = 3 mains)", () => {
    const res = evalFang([
      inst("fangs-executeur-1", { addedEquipmentIds: ["faucille-os", "croc-de-fiel"] }),
    ]);
    expect(res.issues.some((i) => i.ruleId === "hands-over-capacity")).toBe(true);
  });
});

describe("cartes spéciales payantes", () => {
  it("« Apprentie de Nyx » coûte 15 Ko et octroie l'ostéomancie à la Goulue", () => {
    const goulue = inst("fangs-goulue-1", { specialCardIds: ["apprentie-de-nyx"] });
    const res = evalFang([goulue]);
    expect(res.totalCost).toBe(60); // 45 + 15
    expect(res.grantedSkills[goulue.instanceId]?.map((g) => g.skillId)).toContain("osteomancie");
  });

  it("« Apprentie de Nyx » expose le bonus de caractéristique pour l'affichage (stat-modifier « en jeu »)", () => {
    const goulue = inst("fangs-goulue-1", { specialCardIds: ["apprentie-de-nyx"] });
    const res = evalFang([goulue]);
    // +niveau (I = 1) en Initiative, effet « en jeu » (non calculé au coût) mais affiché.
    expect(res.statDeltas[goulue.instanceId]?.i).toBe(1);
  });

  it("« Apprentie de Nyx » ne peut pas être attribuée à un non-Goulue", () => {
    const res = evalFang([inst("fangs-larbin-1", { specialCardIds: ["apprentie-de-nyx"] })]);
    expect(res.issues.some((i) => i.ruleId === "special-card-scope:apprentie-de-nyx")).toBe(true);
  });

  it("signale un équipement réservé porté par une figurine non éligible", () => {
    // Le Madrier est réservé au trait « synkherces » ; un Dogon n'y a pas droit.
    const res = evaluateList(catalog, makeList([inst("gouns-dogon-1", { addedEquipmentIds: ["madrier"] })], "gouns"));
    expect(res.issues.some((i) => i.ruleId === "reserved-madrier")).toBe(true);
  });

  it("n'alerte pas quand la figurine éligible porte l'équipement réservé", () => {
    const res = evaluateList(catalog, makeList([inst("gouns-guerrier-albinos-3", { addedEquipmentIds: ["madrier"] })], "gouns"));
    expect(res.issues.some((i) => i.ruleId === "reserved-madrier")).toBe(false);
  });
});
