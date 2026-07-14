import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import type { ListDocument, ProfileInstance } from "../model";
import { eligibleMountsFor, equipmentDiscount, evaluateList, mountSheetSkills, mountOptionSkills } from "./evaluate";
import { affinityWays, castableSpells, maxPagesInPool, pageAllocation } from "./magic";

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

describe("effet d'équipement (grant-skill)", () => {
  it("la Faucille d'Os (équip. de base de Xayìn) octroie « Riposte » à son porteur", () => {
    const x = inst("fangs-xayin-2");
    const res = evalFang([x]);
    expect(res.grantedSkills[x.instanceId]?.map((s) => s.skillId)).toContain("riposte");
  });

  it("retirer la Faucille d'Os retire l'octroi de « Riposte »", () => {
    const x = inst("fangs-xayin-2", { removedBaseEquipmentIds: ["faucille-os"] });
    const res = evalFang([x]);
    expect(res.grantedSkills[x.instanceId]?.map((s) => s.skillId) ?? []).not.toContain("riposte");
  });
});

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

  it("limitation par (modèle, niveau) : niveaux distincts coexistent, variantes de loadout partagent le compteur", () => {
    // Père de Famille « U » N2 + « U » N3 : niveaux distincts → coexistent (pas d'erreur).
    const twoLevels = evaluateList(
      catalog,
      makeList([inst("gouns-pere-de-famille-2"), inst("gouns-pere-de-famille-3")], "gouns"),
    );
    expect(twoLevels.issues.some((i) => i.ruleId?.startsWith("limitation:"))).toBe(false);

    // Champion Tribal N2 : deux variantes de loadout, limitation X=2 partagée → 2 + 1 = 3 > 2 → erreur.
    const variantsOver = evaluateList(
      catalog,
      makeList(
        [
          inst("gouns-champion-tribal-javelots-2"),
          inst("gouns-champion-tribal-javelots-2"),
          inst("gouns-champion-tribal-ngao-2"),
        ],
        "gouns",
      ),
    );
    expect(variantsOver.issues.some((i) => i.ruleId === "limitation:champion-tribal#2")).toBe(true);

    // Champion Tribal N3 : deux variantes « U » → une de chaque = 2 > 1 → erreur (unicité partagée).
    const uniqueVariants = evaluateList(
      catalog,
      makeList([inst("gouns-champion-tribal-javelots-3"), inst("gouns-champion-tribal-ngao-3")], "gouns"),
    );
    expect(uniqueVariants.issues.some((i) => i.ruleId === "limitation:champion-tribal#3")).toBe(true);
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
    for (const d of dogons) expect(res.statDeltas[d.instanceId]?.t).toBe(3); // T de base (-) → 3
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
  it("les munitions ajoutent le prix du palier choisi (par type) au coût", () => {
    const base = evalFang([inst("fangs-executeur-1", { addedEquipmentIds: ["arbalete-de-poing"] })]).totalCost;
    const withMun = evalFang([
      inst("fangs-executeur-1", {
        addedEquipmentIds: ["arbalete-de-poing"],
        // Carreaux : Simple au palier 15 Ko + Perce-armure au palier 5 Ko.
        munitions: { "arbalete-de-poing": { simple: 1, "perce-armure": 0 } },
      }),
    ]).totalCost;
    expect(withMun - base).toBe(20); // 15 + 5
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

describe("carte à portée Ost (Pacte du Secret)", () => {
  const withOst = (members: ProfileInstance[], cardIds: string[]) => ({
    ...makeList(members, "kharns", "bataille"),
    ost: { cardIds },
  });
  const has = (res: ReturnType<typeof evaluateList>, ruleId: string) =>
    res.issues.some((i) => i.ruleId === ruleId);

  it("active la carte et octroie « Rusé » à tout l'Ost quand ≥4 personnages requis sont présents", () => {
    const myriam = inst("kharns-myriam");
    const members = [myriam, inst("kharns-syrga"), inst("kharns-engueran"), inst("kharns-prince")];
    const res = evaluateList(catalog, withOst(members, ["pacte-du-secret"]));
    expect(has(res, "ost-card:pacte-du-secret")).toBe(false);
    expect(res.grantedSkills[myriam.instanceId]?.some((s) => s.skillId === "rusee")).toBe(true);
    // Provenance : la compétence octroyée pointe vers la carte responsable.
    expect(res.effectSources[myriam.instanceId]?.["skill:rusee"]?.[0]?.label).toBe("Pacte du Secret");
  });

  it("n'octroie RIEN tant que la carte n'est pas sélectionnée, même si la composition est réunie", () => {
    const myriam = inst("kharns-myriam");
    const members = [myriam, inst("kharns-syrga"), inst("kharns-engueran"), inst("kharns-prince")];
    const res = evaluateList(catalog, withOst(members, [])); // carte non sélectionnée
    expect(res.grantedSkills[myriam.instanceId]?.some((s) => s.skillId === "rusee")).toBeFalsy();
  });

  it("erreur si la carte est sélectionnée mais la composition n'est pas remplie (< 4)", () => {
    const members = [inst("kharns-myriam"), inst("kharns-syrga")];
    const res = evaluateList(catalog, withOst(members, ["pacte-du-secret"]));
    expect(has(res, "ost-card:pacte-du-secret")).toBe(true);
  });

  it("erreur d'indisponibilité si la figurine-source (Myriam) est absente", () => {
    const members = [inst("kharns-syrga"), inst("kharns-engueran"), inst("kharns-prince")];
    const res = evaluateList(catalog, withOst(members, ["pacte-du-secret"]));
    expect(has(res, "ost-card-unavailable:pacte-du-secret")).toBe(true);
  });
});

describe("carte intrinsèque à effet ciblant la source (Syrga - Dévotion Intrépide)", () => {
  const skills = (res: ReturnType<typeof evaluateList>, id: string) =>
    (res.grantedSkills[id] ?? []).map((s) => s.skillId);

  it("Syrga gagne « Embuscade » et « Héroïque » si le Prince est dans son Fer de Lance", () => {
    const syrga = inst("kharns-syrga");
    const res = evaluateList(catalog, makeList([syrga, inst("kharns-prince")], "kharns", "bataille"));
    expect(skills(res, syrga.instanceId)).toEqual(expect.arrayContaining(["embuscade", "heroique"]));
  });

  it("Syrga ne gagne rien si ni le Prince ni Engueran ne sont présents", () => {
    const syrga = inst("kharns-syrga");
    const res = evaluateList(catalog, makeList([syrga, inst("kharns-maitre-ordre")], "kharns", "bataille"));
    expect(skills(res, syrga.instanceId)).not.toContain("embuscade");
  });
});

describe("Khérops - concepts (Lieutenant / Commandant / Ogodeï)", () => {
  const g1 = () => inst("kherops-guerrier-1-1");

  it("Lieutenant : +1 à la limite des Khérops « X » (4 Guerriers Lim 3 OK avec un Lieutenant)", () => {
    const four = [g1(), g1(), g1(), g1()];
    const sans = evaluateList(catalog, makeList(four, "kherops", "bataille"));
    expect(sans.issues.some((i) => i.ruleId === "limitation:kherops-guerrier-1#1")).toBe(true);
    const avec = evaluateList(catalog, makeList([...four, inst("kherops-lieutenant-2")], "kherops", "bataille"));
    expect(avec.issues.some((i) => i.ruleId === "limitation:kherops-guerrier-1#1")).toBe(false);
    expect(avec.limitBonuses["kherops-guerrier-1#1"]).toBe(1);
  });

  it("Ogodeï : −10 Ko sur une arme à 2 mains ajoutée, rien sur une arme à 1 main", () => {
    const twoH = inst("kherops-ogodei-3", { addedEquipmentIds: ["fauchard-kherops"] });
    const r2 = evaluateList(catalog, makeList([twoH], "kherops", "bataille"));
    expect(r2.costByInstance[twoH.instanceId]).toBe(165 + 30 - 10);
    const oneH = inst("kherops-ogodei-3", { addedEquipmentIds: ["etoile-de-mort"] });
    const r1 = evaluateList(catalog, makeList([oneH], "kherops", "bataille"));
    expect(r1.costByInstance[oneH.instanceId]).toBe(165 + 20);
  });

  it("Commandant : −5 Ko à un Guerrier qui change son arme de base (rien s'il ne fait qu'ajouter)", () => {
    const cmd = inst("kherops-commandant-3");
    const swap = inst("kherops-guerrier-1-1", { removedBaseEquipmentIds: ["kherops-marteau"], addedEquipmentIds: ["kherops-francisque"] });
    const r = evaluateList(catalog, makeList([cmd, swap], "kherops", "bataille"));
    expect(r.costByInstance[swap.instanceId]).toBe(79 - 14 + 9 - 5);
    const addOnly = inst("kherops-guerrier-1-1", { addedEquipmentIds: ["kherops-francisque"] });
    const r2 = evaluateList(catalog, makeList([cmd, addOnly], "kherops", "bataille"));
    expect(r2.costByInstance[addOnly.instanceId]).toBe(79 + 9);
  });

  it("Ogodeï : règle de remise −10 exposée, applicable aux armes à 2 mains uniquement", () => {
    const og = inst("kherops-ogodei-3");
    const r = evaluateList(catalog, makeList([og], "kherops", "bataille"));
    const rules = r.equipmentCostRules[og.instanceId];
    expect(rules?.length ?? 0).toBeGreaterThan(0);
    expect(equipmentDiscount(catalog, "fauchard-kherops", rules, [])).toBe(-10);
    expect(equipmentDiscount(catalog, "etoile-de-mort", rules, [])).toBe(0);
  });

  it("Commandant : règle de remise −5 aux Guerriers, seulement si l'arme de base est retirée", () => {
    const cmd = inst("kherops-commandant-3");
    const g = inst("kherops-guerrier-1-1");
    const r = evaluateList(catalog, makeList([cmd, g], "kherops", "bataille"));
    const rules = r.equipmentCostRules[g.instanceId];
    expect(rules?.some((x) => x.requiresBaseSwap)).toBe(true);
    expect(equipmentDiscount(catalog, "kherops-francisque", rules, [])).toBe(0);
    expect(equipmentDiscount(catalog, "kherops-francisque", rules, ["kherops-marteau"])).toBe(-5);
  });

  it("Bannière Khéropse : octroie un dé de maîtrise au Porte-Bannière qui la porte", () => {
    const pb = inst("kherops-porte-banniere-2", { specialCardIds: ["banniere-kheropse"] });
    const r = evaluateList(catalog, makeList([pb], "kherops", "bataille"));
    expect(r.grantedMasteryDice[pb.instanceId]?.length).toBe(1);
    const sans = inst("kherops-porte-banniere-2");
    const r2 = evaluateList(catalog, makeList([sans], "kherops", "bataille"));
    expect(r2.grantedMasteryDice[sans.instanceId]).toBeUndefined();
  });

  it("Borax : une arme/armure améliorée confère ses compétences au Guerrier équipé", () => {
    const forge = inst("kherops-forgeronne-2");
    const g = inst("kherops-guerrier-1-1", {
      addedEquipmentIds: ["brigandine"],
      equipmentUpgrades: { "kherops-marteau": ["borax-arme"], brigandine: ["borax-armure"] },
    });
    const r = evaluateList(catalog, makeList([forge, g], "kherops", "bataille"));
    const gs = r.grantedSkills[g.instanceId] ?? [];
    const has = (skillId: string, value?: string) => gs.some((s) => s.skillId === skillId && s.value === value);
    expect(has("specialiste", "attaque")).toBe(true);
    expect(has("specialiste", "défense")).toBe(true);
    expect(has("instinct-de-survie")).toBe(true);
  });

  it("Borax : aucune compétence conférée sans l'amélioration appliquée", () => {
    const forge = inst("kherops-forgeronne-2");
    const g = inst("kherops-guerrier-1-1");
    const r = evaluateList(catalog, makeList([forge, g], "kherops", "bataille"));
    expect((r.grantedSkills[g.instanceId] ?? []).some((s) => s.skillId === "specialiste")).toBe(false);
  });
});

describe("stat-max (Doctrine de l'Ordre)", () => {
  it("n'affiche pas de modification quand le max du groupe n'excède pas la base (Maître seul)", () => {
    const maitre = inst("kharns-maitre-ordre");
    const res = evaluateList(catalog, makeList([maitre], "kharns", "bataille"));
    expect(res.statDeltas[maitre.instanceId]?.t).toBeUndefined();
    expect(res.statDeltas[maitre.instanceId]?.i).toBeUndefined();
  });
});

describe("amélioration d'équipement octroyée (unlock-upgrade)", () => {
  it("empoisonner une arme CaC de Key ajoute 10 Ko et l'octroi est exposé", () => {
    const plain = inst("kharns-key", { addedEquipmentIds: ["couteau"] });
    const poisoned = inst("kharns-key", {
      addedEquipmentIds: ["couteau"],
      equipmentUpgrades: { couteau: ["poison"] },
    });
    const r1 = evaluateList(catalog, makeList([plain], "kharns"));
    const r2 = evaluateList(catalog, makeList([poisoned], "kharns"));
    expect(r2.costByInstance[poisoned.instanceId]).toBe(r1.costByInstance[plain.instanceId] + 10);
    expect(r2.grantedUpgrades[poisoned.instanceId]?.some((u) => u.upgradeId === "poison")).toBe(true);
  });
  it("ne facture pas une amélioration non octroyée à la figurine", () => {
    // Un Guerrier n'a pas l'octroi « poison » : la cocher ne change rien au coût.
    const g = inst("kharns-guerrier-1", {
      addedEquipmentIds: ["couteau"],
      equipmentUpgrades: { couteau: ["poison"] },
    });
    const ref = inst("kharns-guerrier-1", { addedEquipmentIds: ["couteau"] });
    const rg = evaluateList(catalog, makeList([g], "kharns"));
    const rref = evaluateList(catalog, makeList([ref], "kharns"));
    expect(rg.costByInstance[g.instanceId]).toBe(rref.costByInstance[ref.instanceId]);
  });
});

describe("consommation d'emplacement (Gaubert, LIM P → place de Paladin III)", () => {
  const hasSlotErr = (res: ReturnType<typeof evaluateList>) =>
    res.issues.some((i) => i.ruleId === "consumes-slot:paladin#3");
  it("Gaubert + 2 Paladins III dépasse la limite de 2", () => {
    const res = evaluateList(
      catalog,
      makeList([inst("kharns-paladin-3"), inst("kharns-paladin-3"), inst("kharns-gaubert")], "kharns", "bataille"),
    );
    expect(hasSlotErr(res)).toBe(true);
  });
  it("Gaubert + 1 Paladin III reste dans la limite", () => {
    const res = evaluateList(
      catalog,
      makeList([inst("kharns-paladin-3"), inst("kharns-gaubert")], "kharns", "bataille"),
    );
    expect(hasSlotErr(res)).toBe(false);
  });
});

describe("effet conditionné au meneur (Engueran)", () => {
  // makeList désigne le premier membre comme meneur.
  it("les Paladins coûtent 15 Ko de moins quand Engueran est meneur", () => {
    const eng = inst("kharns-engueran");
    const pal = inst("kharns-paladin-3");
    const leader = evaluateList(catalog, makeList([eng, pal], "kharns", "bataille"));
    const notLeader = evaluateList(catalog, makeList([pal, eng], "kharns", "bataille"));
    expect(leader.costByInstance[pal.instanceId]).toBe(notLeader.costByInstance[pal.instanceId] - 15);
  });
});

describe("montures", () => {
  it("éligibilité : faction + écart de niveau ±1", () => {
    const g1 = catalog.profiles.find((p) => p.id === "kharns-guerrier-1")!; // niv1 khârn
    const ids = eligibleMountsFor(catalog, g1).map((m) => m.id);
    expect(ids).toContain("quagga-1");
    expect(ids).toContain("quagga-2");
    expect(ids).not.toContain("quagga-3"); // niveau 3 hors ±1
    expect(ids.every((id) => id.startsWith("quagga"))).toBe(true); // pas de koelod/mochère
  });

  it("Berseker : aucune monture éligible, et une monture posée est une erreur", () => {
    const b = catalog.profiles.find((p) => p.id === "kherops-berserker-2")!;
    expect(eligibleMountsFor(catalog, b)).toHaveLength(0);
    const bad = inst("kherops-berserker-2", { mount: { mountId: "koelod-2" } });
    const r = evaluateList(catalog, makeList([bad], "kherops", "bataille"));
    expect(r.issues.some((i) => i.severity === "error" && i.ruleId === "mount-koelod-2")).toBe(true);
  });

  it("équipement réservé aux montés (Lance de cavalerie) sans monture → invalide", () => {
    const withMount = inst("kharns-paladin-cavalier-2", {
      mount: { mountId: "quagga-2" },
      addedEquipmentIds: ["eq-lance-cavalerie"],
    });
    const ok = evaluateList(catalog, makeList([withMount], "kharns", "bataille"));
    expect(ok.issues.some((i) => i.ruleId === "mount-equip-eq-lance-cavalerie")).toBe(false);

    const noMount = inst("kharns-paladin-cavalier-2", { addedEquipmentIds: ["eq-lance-cavalerie"] });
    const r = evaluateList(catalog, makeList([noMount], "kharns", "bataille"));
    expect(
      r.issues.some((i) => i.severity === "error" && i.ruleId === "mount-equip-eq-lance-cavalerie"),
    ).toBe(true);
  });

  it("amélioration intrinsèque d'un équipement de monture (Caparaçon → Pointes acérées) comptée dans le coût", () => {
    const withUp = inst("kharns-paladin-cavalier-2", {
      mount: {
        mountId: "quagga-2",
        addedEquipmentIds: ["eq-caparacon"],
        equipmentUpgrades: { "eq-caparacon": ["caparacon-pointes"] },
      },
    });
    const withoutUp = inst("kharns-paladin-cavalier-2", {
      mount: { mountId: "quagga-2", addedEquipmentIds: ["eq-caparacon"] },
    });
    const a = evaluateList(catalog, makeList([withUp], "kharns", "bataille"));
    const b = evaluateList(catalog, makeList([withoutUp], "kharns", "bataille"));
    expect(a.mountCost[withUp.instanceId] - b.mountCost[withoutUp.instanceId]).toBe(5); // +5 Ko Pointes acérées
  });

  it("partage cavalier : stats + allonge seulement (PV/stature/compétences NON partagés)", () => {
    const g = inst("kharns-paladin-cavalier-2", { mount: { mountId: "quagga-2" } });
    const r = evaluateList(catalog, makeList([g], "kharns", "bataille"));
    expect(r.statDeltas[g.instanceId]?.v).toBe(1); // stat partagée
    expect(r.statDeltas[g.instanceId]?.pv).toBeUndefined(); // PV propre à la monture
    expect(r.statDeltas[g.instanceId]?.stature).toBeUndefined(); // stature propre à la monture
    expect(r.mountAllonge[g.instanceId]).toBe(0.5);
    // La compétence de la monture (sacrifice) reste sur SA fiche, pas sur le cavalier.
    expect((r.grantedSkills[g.instanceId] ?? []).some((s) => s.skillId === "sacrifice")).toBe(false);
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("coût de la monture séparé du cavalier mais compté dans le total", () => {
    const solo = inst("kharns-paladin-cavalier-2");
    const base = evaluateList(catalog, makeList([solo], "kharns", "bataille")).costByInstance[solo.instanceId];
    const g = inst("kharns-paladin-cavalier-2", { mount: { mountId: "quagga-2" } });
    const r = evaluateList(catalog, makeList([g], "kharns", "bataille"));
    expect(r.costByInstance[g.instanceId]).toBe(base); // coût cavalier inchangé
    expect(r.mountCost[g.instanceId]).toBe(45); // coût monture à part
    expect(r.totalCost).toBe(base + 45); // total = cavalier + monture
  });

  it("mountSheetSkills : natives de la monture + 3 transmises (endurance/harcèlement/instinct), meilleure valeur", () => {
    const koelod3 = catalog.mounts.find((m) => m.id === "koelod-3")!; // charge-brutale 3, peau-dure, stable
    const guerrier = catalog.profiles.find((p) => p.id === "kherops-guerrier-1-2")!; // charge-brutale 1 (non transmise)
    const sk = mountSheetSkills(koelod3, guerrier);
    // charge-brutale reste la valeur de la monture (3) : elle n'est PAS transmise par le cavalier.
    expect(sk.find((s) => s.skillId === "charge-brutale")?.value).toBe(3);
    expect(sk.some((s) => s.skillId === "peau-dure")).toBe(true);
    // Une compétence transmissible native du cavalier apparaît sur la monture.
    const withEndurance: typeof guerrier = { ...guerrier, skills: [...guerrier.skills, { skillId: "endurance" }] };
    expect(mountSheetSkills(koelod3, withEndurance).some((s) => s.skillId === "endurance")).toBe(true);
  });

  it("effet de monture : la Mochère II rend gratuit le petit grimoire du cavalier", () => {
    const gid = catalog.profiles.find((p) => p.factionId === "gouns" && p.level === 2)!.id;
    const noMount = inst(gid, { grimoireId: "petit" });
    const withMount = inst(gid, { grimoireId: "petit", mount: { mountId: "mochere-2" } });
    const base = evaluateList(catalog, makeList([noMount], "gouns", "bataille")).costByInstance[noMount.instanceId];
    const r = evaluateList(catalog, makeList([withMount], "gouns", "bataille"));
    expect(r.costByInstance[withMount.instanceId]).toBe(base - 20); // petit grimoire (20 Ko) offert
    expect(r.mountCost[withMount.instanceId]).toBe(45); // coût de la Mochère II à part
    expect(r.grimoireDiscount[withMount.instanceId]?.petit).toBe(20); // exposé par palier (Magie / résumé)
  });

  it("best-value : compétence commune cavalier/monture conservée à la meilleure valeur", () => {
    // Guerrier Khérops (Charge Brutale 1) + Koelod II (Charge Brutale 2) → 2 sur la fiche du cavalier.
    const g = inst("kherops-guerrier-1-1", { mount: { mountId: "koelod-2" } });
    const r = evaluateList(catalog, makeList([g], "kherops", "bataille"));
    expect(r.skillValues[g.instanceId]?.["charge-brutale"]).toBe(2);
  });

  it("options (p.32) : coût au bon panier, réservations, transmission et partage", () => {
    const solo = inst("kharns-paladin-cavalier-2");
    const base = evaluateList(catalog, makeList([solo], "kharns", "bataille")).costByInstance[solo.instanceId];
    const r = inst("kharns-paladin-cavalier-2", {
      mount: { mountId: "quagga-2" },
      mountOptionIds: { "opt-autorite": 1, "opt-endurance": 1, "opt-repoussement": 1 },
    });
    const e = evaluateList(catalog, makeList([r], "kharns", "bataille"));
    // Autorité (10, cavalier) + Endurance (20, partagée) sur le cavalier ; Repoussement (quagga 25) sur la monture.
    expect(e.costByInstance[r.instanceId]).toBe(base + 30);
    expect(e.mountCost[r.instanceId]).toBe(45 + 25);
    const granted = (e.grantedSkills[r.instanceId] ?? []).map((s) => s.skillId);
    expect(granted).toContain("autorite");
    expect(granted).toContain("endurance");
    // Endurance achetée par le cavalier se transmet à la monture ; Repoussement acheté est sur sa fiche.
    const rider = catalog.profiles.find((p) => p.id === "kharns-paladin-cavalier-2")!;
    const mount = catalog.mounts.find((m) => m.id === "quagga-2")!;
    const sheet = mountSheetSkills(mount, rider, {
      mountBought: mountOptionSkills(catalog, r, ["mount", "both"]),
      riderBought: mountOptionSkills(catalog, r, ["rider", "both"]),
    }).map((s) => s.skillId);
    expect(sheet).toContain("repoussement");
    expect(sheet).toContain("endurance");
  });

  it("options (p.32) : réservation de faction non respectée → erreur", () => {
    // Exécuteur est réservé aux Cavaliers khérops : un Khârn ne peut pas le prendre.
    const r = inst("kharns-paladin-cavalier-2", {
      mount: { mountId: "quagga-2" },
      mountOptionIds: { "opt-executeur": 1 },
    });
    const e = evaluateList(catalog, makeList([r], "kharns", "bataille"));
    expect(e.issues.some((i) => i.ruleId === "mount-option-opt-executeur")).toBe(true);
  });
});

describe("surcoût d'équipement Tembo (règles de bataille p.20)", () => {
  const evalTembo = (m: ProfileInstance[]) => evaluateList(catalog, makeList(m, "tembos"));

  it("+3 Ko par tranche de 10 sur l'équipement AJOUTÉ d'une figurine tembo (écu 12 → 15)", () => {
    const g = inst("tembos-guerrier-2", { addedEquipmentIds: ["ecu"] });
    expect(evalTembo([g]).totalCost).toBe(160 + 12 + 3);
  });

  it("majoration par tranche COMPLÈTE (marteau de guerre 35 → +9)", () => {
    const g = inst("tembos-guerrier-2", { addedEquipmentIds: ["marteau-de-guerre"] });
    expect(evalTembo([g]).totalCost).toBe(160 + 35 + 9);
  });

  it("aucun surcoût sur un équipement déjà au logo Tembo (Khépesh, réservé au trait tembo)", () => {
    const g = inst("tembos-guerrier-2", { addedEquipmentIds: ["khepesh"] });
    expect(evalTembo([g]).totalCost).toBe(160 + 25);
  });

  it("aucun surcoût pour une figurine khémiste (trait non tembo)", () => {
    const k = inst("tembos-guerriere-1", { addedEquipmentIds: ["ecu"] });
    expect(evalTembo([k]).totalCost).toBe(50 + 12);
  });
});

describe("grant-skill « +N si déjà connue » (incrementIfPresent)", () => {
  const evalTembo = (m: ProfileInstance[]) => evaluateList(catalog, makeList(m, "tembos"));

  it("Khépesh : Brutalité native augmentée de 1 (Guerrier II Brutalité 1 → 2)", () => {
    const g = inst("tembos-guerrier-2", { addedEquipmentIds: ["khepesh"] });
    const res = evalTembo([g]);
    // la valeur native (1) est remplacée par 2 via skillValues (pas de double octroi)
    expect(res.skillValues[g.instanceId]?.brutalite).toBe(2);
    expect(res.grantedSkills[g.instanceId]?.some((s) => s.skillId === "brutalite")).toBeFalsy();
  });

  it("Khépesh sur un porteur SANS Brutalité : octroi normal (Brutalité 1)", () => {
    const h = inst("tembos-hierophante-2", { addedEquipmentIds: ["khepesh"] });
    const res = evalTembo([h]);
    expect(res.skillValues[h.instanceId]?.brutalite).toBeUndefined();
    const g = res.grantedSkills[h.instanceId]?.find((s) => s.skillId === "brutalite");
    expect(g?.value).toBe(1);
  });

  it("Symbiose : Moringa d'un allié augmentée de 2 (Guerrière Moringa 2 → 4), non-porteur octroyé à 3", () => {
    const nephtys = inst("tembos-nephtys-3", { specialCardIds: ["symbiose-universelle"] });
    const guerriere = inst("tembos-guerriere-1"); // Moringa 2 natif
    const guerrier = inst("tembos-guerrier-2"); // pas de Moringa
    const res = evalTembo([nephtys, guerriere, guerrier]);
    expect(res.skillValues[guerriere.instanceId]?.moringa).toBe(4);
    expect(res.grantedSkills[guerrier.instanceId]?.find((s) => s.skillId === "moringa")?.value).toBe(3);
  });
});

describe("Affinité X (accès grimoire à une autre voie)", () => {
  const nephtys = catalog.profiles.find((p) => p.id === "tembos-nephtys-3")!;

  it("résout Affinité « Shamanisme » vers la voie shamanisme", () => {
    expect(affinityWays(catalog, nephtys)).toEqual(["shamanisme"]);
  });

  it("un profil sans Affinité n'ouvre aucune voie supplémentaire", () => {
    const g = catalog.profiles.find((p) => p.id === "tembos-guerriere-1")!;
    expect(affinityWays(catalog, g)).toEqual([]);
  });

  it("l'affinité OUVRE la voie pour la sélection de sorts (voie non maîtrisée sinon)", () => {
    // Profil synthétique : aucune voie maîtrisée (ways=[]), Affinité « Ostéomancie », trait fille-de-nyx
    // (pour passer la réserve de trait du sort). Le sort ostéomancien devient sélectionnable via l'affinité.
    const base = catalog.profiles.find((p) => p.id === "tembos-guerrier-2")!;
    const withAffinity = { ...base, skills: [{ skillId: "affinite", value: "Ostéomancie" }], traits: ["fille-de-nyx"] };
    const spells = castableSpells(catalog, withAffinity, new Set(["fille-de-nyx"]), []);
    expect(spells.map((s) => s.id)).toContain("seduction-du-fiel");

    // Contrôle : sans l'affinité, la voie reste fermée (le sort n'est pas listé).
    const noAffinity = { ...base, skills: [], traits: ["fille-de-nyx"] };
    expect(castableSpells(catalog, noAffinity, new Set(["fille-de-nyx"]), []).map((s) => s.id)).not.toContain(
      "seduction-du-fiel",
    );
  });

  it("l'affinité n'annule PAS les réserves profil/trait plus fines (sorts shamanisme de Néphtys restent bloqués)", () => {
    const spells = castableSpells(catalog, nephtys, new Set(nephtys.traits), ["way-1783500043343"]);
    expect(spells.map((s) => s.id)).toContain("guerison-vegetale"); // sa voie Adansonia (rés. khemiste) ✓
    expect(spells.map((s) => s.id)).not.toContain("onde-revigorante"); // shamanisme rés. synkherces ✗
  });

  it("Néphtys voit le sort de test shamanisme via son Affinité (non réservé) + celui d'Adansonia (voie maîtrisée)", () => {
    const spells = castableSpells(catalog, nephtys, new Set(nephtys.traits), ["way-1783500043343"]).map((s) => s.id);
    expect(spells).toContain("test-shamanisme"); // école ouverte par l'Affinité
    expect(spells).toContain("test-adansonia"); // sa voie maîtrisée
  });
});

describe("pools de pages dédiés à une voie (Brassards d'Euthéria)", () => {
  const nephtys = catalog.profiles.find((p) => p.id === "tembos-nephtys-3")!;
  const traits = new Set(nephtys.traits);
  const mk = (over: Partial<ProfileInstance> = {}): ProfileInstance => ({
    instanceId: "n",
    profileId: nephtys.id,
    addedEquipmentIds: [],
    removedBaseEquipmentIds: [],
    spellIds: [],
    ...over,
  });
  const ADANSONIA = "way-1783500043343";

  it("les Brassards créent deux pools dédiés (Adansonia 5 + shamanisme 5), budget général 0 sans grimoire", () => {
    const a = pageAllocation(catalog, nephtys, mk(), traits);
    expect(a.general.cap).toBe(0);
    expect(a.pools.map((p) => [p.wayId, p.cap])).toEqual([
      [ADANSONIA, 5],
      ["shamanisme", 5],
    ]);
    expect(a.over).toBe(false);
  });

  it("retirer les Brassards supprime les pools", () => {
    const a = pageAllocation(catalog, nephtys, mk({ removedBaseEquipmentIds: ["brassards-eutheria"] }), traits);
    expect(a.pools).toEqual([]);
    expect(a.general.cap).toBe(0);
  });

  it("les sorts d'une voie remplissent d'abord leur pool dédié (4 pages Adansonia → pool, général 0)", () => {
    const a = pageAllocation(catalog, nephtys, mk({ spellIds: ["drain-d-energie", "confiance-partagee"] }), traits);
    expect(a.pools.find((p) => p.wayId === ADANSONIA)?.used).toBe(4);
    expect(a.general.used).toBe(0);
    expect(a.over).toBe(false);
  });

  it("le surplus au-delà du pool déborde sur le général → invalide sans grimoire (6 pages Adansonia)", () => {
    const i = mk({ spellIds: ["drain-d-energie", "confiance-partagee", "guerison-vegetale", "test-adansonia"] });
    const a = pageAllocation(catalog, nephtys, i, traits);
    expect(a.pools.find((p) => p.wayId === ADANSONIA)?.used).toBe(5); // pool saturé
    expect(a.general.used).toBe(1); // surplus
    expect(a.over).toBe(true);
  });

  it("un petit grimoire (général 5) absorbe le surplus → redevient valide", () => {
    const i = mk({
      grimoireId: "petit",
      spellIds: ["drain-d-energie", "confiance-partagee", "guerison-vegetale", "test-adansonia"],
    });
    const a = pageAllocation(catalog, nephtys, i, traits);
    expect(a.general.cap).toBe(5);
    expect(a.general.used).toBe(1);
    expect(a.over).toBe(false);
  });

  it("les pools sont indépendants : un sort shamanisme ne consomme pas le pool Adansonia", () => {
    const a = pageAllocation(catalog, nephtys, mk({ spellIds: ["test-shamanisme"] }), traits);
    expect(a.pools.find((p) => p.wayId === "shamanisme")?.used).toBe(1);
    expect(a.pools.find((p) => p.wayId === ADANSONIA)?.used).toBe(0);
    expect(a.general.used).toBe(0);
  });
});

describe("attribution atomique d'un sort dans un pool (maxPagesInPool)", () => {
  it("un sort est indivisible : 3 sorts de 2 pages dans un pool de 5 → 4 pages (le 3ᵉ ne rentre pas)", () => {
    expect(maxPagesInPool([2, 2, 2], 5)).toBe(4);
  });

  it("cherche le meilleur sous-ensemble, pas un remplissage dans l'ordre (1+2+3, cap 5 → 5 via 2+3)", () => {
    expect(maxPagesInPool([1, 2, 3], 5)).toBe(5);
  });

  it("un gros sort qui dépasse l'espace restant est écarté du pool ([4,2] cap 5 → 4)", () => {
    expect(maxPagesInPool([4, 2], 5)).toBe(4);
  });

  it("remplissage exact et cas triviaux", () => {
    expect(maxPagesInPool([2, 3], 5)).toBe(5);
    expect(maxPagesInPool([1, 1, 1], 5)).toBe(3);
    expect(maxPagesInPool([], 5)).toBe(0);
    expect(maxPagesInPool([6], 5)).toBe(0); // un sort plus gros que le pool ne rentre pas
    expect(maxPagesInPool([2, 3], Infinity)).toBe(5); // pool illimité (théorique) absorbe tout
  });
});
