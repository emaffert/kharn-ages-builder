import { describe, it, expect } from "vitest";
import { fangsCatalog } from "@data";
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
    catalogVersion: fangsCatalog.version,
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
  evaluateList(fangsCatalog, makeList(members, faction));

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
    expect(res.grantedSkills[goulue.instanceId]).toContain("osteomancie");
  });

  it("« Apprentie de Nyx » ne peut pas être attribuée à un non-Goulue", () => {
    const res = evalFang([inst("fangs-larbin-1", { specialCardIds: ["apprentie-de-nyx"] })]);
    expect(res.issues.some((i) => i.ruleId === "special-card-scope:apprentie-de-nyx")).toBe(true);
  });
});
