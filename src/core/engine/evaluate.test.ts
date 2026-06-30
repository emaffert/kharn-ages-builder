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

  it("une Fille de Nyx rend gratuit 1 seul Larbin", () => {
    const larbins = [inst("fangs-larbin-1"), inst("fangs-larbin-1"), inst("fangs-larbin-1")];
    const res = evalFang([inst("fangs-apathee-3"), ...larbins]);
    // 140 (Apathée) + 1 Larbin à 0 + 2 Larbins à 35 = 210
    expect(res.totalCost).toBe(210);
    expect(Object.values(res.costByInstance).filter((c) => c === 0)).toHaveLength(1);
  });

  it("deux Filles de Nyx rendent gratuits 2 Larbins (plafond)", () => {
    const larbins = [inst("fangs-larbin-1"), inst("fangs-larbin-1"), inst("fangs-larbin-1")];
    // Apathée + Broutcha sont toutes deux « Fille de Nyx »
    const res = evalFang([inst("fangs-apathee-3"), inst("fangs-broutcha-2"), ...larbins]);
    expect(Object.values(res.costByInstance).filter((c) => c === 0)).toHaveLength(2);
    // 140 + 120 + 0 + 0 + 35 = 295
    expect(res.totalCost).toBe(295);
  });

  it("Djouked coûte 35 de moins en présence de Broutcha", () => {
    const withBroutcha = evalFang([inst("fangs-djouked-2"), inst("fangs-broutcha-2")]);
    const djoukedCost = (l: ReturnType<typeof evalFang>) =>
      Object.entries(l.costByInstance).find(([id]) => id.startsWith("fangs-djouked-2"))![1];
    expect(djoukedCost(withBroutcha)).toBe(55);

    const alone = evalFang([inst("fangs-djouked-2")]);
    expect(djoukedCost(alone)).toBe(90);
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
