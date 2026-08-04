import { describe, it, expect } from "vitest";
import { catalog } from "@data";
import type { Catalog, ListDocument, ProfileInstance, Spell } from "../model";
import { eligibleMountsFor, equipmentDiscount, evaluateList, temboEquipmentSurcharge, mountSheetSkills, mountOptionSkills, slotCapacity, upgradesForEquipment } from "./evaluate";
import {
  affinityWays,
  armorRole,
  armorsWorn,
  protects,
  castWays,
  castableSpells,
  forbiddenGrimoires,
  genericSpellAllocation,
  maxPagesInPool,
  pageAllocation,
  spellGrants,
} from "./magic";
import {
  cardMatchesBanner,
  specialCardCost,
} from "./evaluate";
import { effectiveOrigin, needsOriginChoice } from "./origin";
import {
  equipmentAllowedIn,
  isRecruitableIn,
  openRecruitmentAccepts,
  openRecruitmentRefuses,
  recruitCost,
  recruitableWithoutSeal,
} from "./recruitment";
import { isSlaveIn } from "./slavery";

/** L'identifiant de la voie Adansonia dans le catalogue (créée avec un id technique). */
const ADANSONIA = "way-1783500043343";

/**
 * Sorts de banc d'essai : une page, aucune réservation. Éprouver l'Affinité et les pools de pages
 * dédiés demande un sort qu'un lanceur peut librement choisir dans une voie donnée - or tous les
 * sorts réels sont réservés. Ils sont montés ici plutôt que dans `catalog.json` : des bouchons
 * « Test - X » y ont traîné jusqu'à ce que les vrais sorts arrivent, et se sont retrouvés servis
 * aux joueurs. Un banc d'essai n'a rien à faire dans la donnée livrée.
 */
const BENCH_SPELLS: Spell[] = [
  {
    id: "banc-shamanisme",
    name: "Banc d'essai - Shamanisme",
    kind: "grimoire",
    magicWayId: "shamanisme",
    pages: 1,
    target: "Soi-même",
    difficulties: [],
  },
  {
    id: "banc-adansonia",
    name: "Banc d'essai - Adansonia",
    kind: "grimoire",
    magicWayId: ADANSONIA,
    pages: 1,
    target: "Soi-même",
    difficulties: [],
  },
  // Même voie que le premier, mais réservé à un trait : sert à montrer que l'Affinité ouvre l'école
  // sans lever pour autant les réserves plus fines.
  {
    id: "banc-shamanisme-reserve",
    name: "Banc d'essai - Shamanisme réservé",
    kind: "grimoire",
    magicWayId: "shamanisme",
    pages: 1,
    reservedTo: { trait: "synkherces" },
    target: "Soi-même",
    difficulties: [],
  },
];

/** Le catalogue livré, augmenté des seuls sorts de banc d'essai. */
const benched: Catalog = { ...catalog, spells: [...catalog.spells, ...BENCH_SPELLS] };

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
    // 80 (Exécuteur II) + 25 (arbalète) - 10 (arme de prédilection) = 95
    expect(res.totalCost).toBe(95);
    // Sans la remise, l'arbalète coûterait son plein tarif : c'est bien elle qu'on mesure.
    const sansRemise = evalFang([inst("fangs-goulue-1", { addedEquipmentIds: ["arbalete-de-poing"] })]);
    expect(sansRemise.totalCost).toBe(45 + 25);
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

describe("Likans : capacité de rattachement (Σ niveaux ≤ niveau du porteur)", () => {
  // Porteuse « femelle Fang » de niveau `carrier` avec les Likans donnés rattachés.
  const withLikans = (carrierId: string, likanIds: string[]) => {
    const likans = likanIds.map((id) => inst(id));
    const carrier = inst(carrierId, { attachedInstanceIds: likans.map((l) => l.instanceId) });
    return evalFang([carrier, ...likans]);
  };
  const hasAttachmentIssue = (likanIds: string[], carrierId: string) =>
    withLikans(carrierId, likanIds).issues.some((i) => i.ruleId === "likan-attachment");

  // Un Likan « special » n'a pas de plafond d'emplacement (modèle, niveau) : sa limite est la
  // capacité de rattachement, pas un cap par slot. Régression du bug « un seul Likan N1 possible ».
  it("slotCapacity d'un Likan (special) est illimité à tous les niveaux", () => {
    expect(slotCapacity(catalog, "likan", 1)).toBe(Infinity);
    expect(slotCapacity(catalog, "likan", 2)).toBe(Infinity);
    expect(slotCapacity(catalog, "likan", 3)).toBe(Infinity);
  });

  it("plusieurs Likans N1 sur un même porteur (le bug rapporté)", () => {
    // Porteuse N2 → 2 Likans N1 (Σ = 2 ≤ 2) : autorisé.
    expect(hasAttachmentIssue(["fangs-likan-1", "fangs-likan-1"], "fangs-goulue-2")).toBe(false);
    // Porteuse N3 → 3 Likans N1 (Σ = 3 ≤ 3) : autorisé.
    expect(
      hasAttachmentIssue(["fangs-likan-1", "fangs-likan-1", "fangs-likan-1"], "fangs-apathee-3"),
    ).toBe(false);
  });

  it("porteur de niveau 1 : un seul Likan N1", () => {
    expect(hasAttachmentIssue(["fangs-likan-1"], "fangs-goulue-1")).toBe(false);
    // Σ = 2 > 1 : refusé.
    expect(hasAttachmentIssue(["fangs-likan-1", "fangs-likan-1"], "fangs-goulue-1")).toBe(true);
  });

  it("porteur de niveau 3 : configurations mixtes valides (Σ ≤ 3)", () => {
    expect(hasAttachmentIssue(["fangs-likan-3"], "fangs-apathee-3")).toBe(false); // 3
    expect(hasAttachmentIssue(["fangs-likan-1", "fangs-likan-2"], "fangs-apathee-3")).toBe(false); // 1+2
    expect(hasAttachmentIssue(["fangs-likan-2"], "fangs-apathee-3")).toBe(false); // 2, sous la capacité
  });

  it("porteur de niveau 3 : configurations en excès (Σ > 3)", () => {
    expect(hasAttachmentIssue(["fangs-likan-2", "fangs-likan-2"], "fangs-apathee-3")).toBe(true); // 4
    expect(
      hasAttachmentIssue(["fangs-likan-1", "fangs-likan-1", "fangs-likan-2"], "fangs-apathee-3"),
    ).toBe(true); // 4
    expect(hasAttachmentIssue(["fangs-likan-3", "fangs-likan-1"], "fangs-apathee-3")).toBe(true); // 4
  });

  it("un Likan trop haut niveau pour le porteur", () => {
    expect(hasAttachmentIssue(["fangs-likan-2"], "fangs-goulue-1")).toBe(true); // 2 > 1
    expect(hasAttachmentIssue(["fangs-likan-3"], "fangs-goulue-2")).toBe(true); // 3 > 2
    expect(hasAttachmentIssue(["fangs-likan-3"], "fangs-apathee-3")).toBe(false); // 3 = 3, limite exacte
  });

  it("porteur sans Likan rattaché : aucune contrainte de capacité", () => {
    expect(evalFang([inst("fangs-goulue-1")]).issues.some((i) => i.ruleId === "likan-attachment")).toBe(false);
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

  it("ignore un « forbidGrimoires » porté par un autre type de contrainte", () => {
    // Le param n'a d'effet que sur une contrainte « forbids-grimoire » : ailleurs, il est inerte.
    const meneuse = catalog.profiles.find((p) => p.id === "fangs-meneuse-1")!;
    const detourne = {
      ...meneuse,
      recruitment: meneuse.recruitment.map((c) =>
        c.type === "forbids-grimoire" ? { ...c, type: "forbids-equipment" as const } : c,
      ),
    };
    expect(forbiddenGrimoires(detourne).size).toBe(0);
    expect(forbiddenGrimoires(meneuse).has("grand")).toBe(true);
  });

  // « 1 seule armure par Safar en plus d'un gambison » : le Gambison a son propre emplacement.
  it("deux armures ordinaires → invalide", () => {
    const res = evalFang([
      inst("fangs-larbin-1", { addedEquipmentIds: ["armure-de-cuir", "cotte-de-maille"] }),
    ]);
    expect(res.issues.some((i) => i.ruleId === "multiple-armor")).toBe(true);
  });

  it("une armure + un gambison → valide", () => {
    const res = evalFang([
      inst("fangs-larbin-1", { addedEquipmentIds: ["armure-de-cuir", "gambison"] }),
    ]);
    expect(res.issues.some((i) => i.ruleId === "multiple-armor")).toBe(false);
  });

  it("sorts génériques : budget en niveaux, pas en pages", () => {
    // Passe-Passe vaut 3 niveaux : hors de portée d'un lanceur de niveau 2, à la limite pour un niveau 3.
    const bharbathos = catalog.profiles.find((p) => p.id === "guilde-noire-bharbathos-3")!;
    expect(genericSpellAllocation(catalog, bharbathos, inst(bharbathos.id, { spellIds: ["guilde-noire-passe-passe"] })))
      .toEqual({ cap: 3, used: 3, over: false });
    expect(
      genericSpellAllocation(catalog, { ...bharbathos, level: 2 }, inst(bharbathos.id, { spellIds: ["guilde-noire-passe-passe"] })).over,
    ).toBe(true);
  });

  it("un générique n'entame pas le budget de pages du grimoire", () => {
    const bharbathos = catalog.profiles.find((p) => p.id === "guilde-noire-bharbathos-3")!;
    const alloc = pageAllocation(catalog, bharbathos, inst(bharbathos.id, { spellIds: ["guilde-noire-passe-passe"] }), new Set(bharbathos.traits));
    expect(alloc.totalUsed).toBe(0);
  });

  it("le gambison seul ne consomme pas l'emplacement d'armure ordinaire", () => {
    const armor = armorsWorn(catalog, catalog.profiles.find((p) => p.id === "fangs-larbin-1")!, {
      ...inst("fangs-larbin-1"),
      addedEquipmentIds: ["gambison"],
    });
    expect(armor).toEqual({ standard: 0, stackable: 1 });
  });
});

describe("portée d'une contrainte « nécessite une présence »", () => {
  // La contrainte « Muskh sans Xayìn » est portée par la carte « Xayìn & Muskh ».
  const withScope = (scope: "fer-de-lance" | "ost"): Catalog => ({
    ...catalog,
    specialCards: catalog.specialCards.map((card) => ({
      ...card,
      constraints: card.constraints.map((c) =>
        c.id === "muskh-requires-xayin" ? { ...c, scope } : c,
      ),
    })),
  });

  /** Deux Fers de Lance dans un même Ost. */
  const twoFdl = (a: ProfileInstance[], b: ProfileInstance[]): ListDocument => ({
    ...makeList([...a, ...b]),
    fersDeLance: [
      { id: "fdl1", factionId: "fangs", leaderInstanceId: a[0]?.instanceId ?? "", members: a },
      { id: "fdl2", factionId: "fangs", leaderInstanceId: b[0]?.instanceId ?? "", members: b },
    ],
  });

  const flagged = (cat: Catalog, list: ListDocument) =>
    evaluateList(cat, list).issues.some((i) => i.ruleId === "muskh-requires-xayin");

  it("portée « fer-de-lance » : Xayìn dans l'autre Fer de Lance ne suffit pas", () => {
    const list = twoFdl([inst("fangs-muskh-1")], [inst("fangs-xayin-2")]);
    expect(flagged(withScope("fer-de-lance"), list)).toBe(true);
  });

  it("portée « ost » : Xayìn n'importe où dans la liste suffit", () => {
    const list = twoFdl([inst("fangs-muskh-1")], [inst("fangs-xayin-2")]);
    expect(flagged(withScope("ost"), list)).toBe(false);
  });

  it("portée « ost » : Xayìn absent de toute la liste reste une erreur", () => {
    const list = twoFdl([inst("fangs-muskh-1")], [inst("fangs-goulue-1")]);
    expect(flagged(withScope("ost"), list)).toBe(true);
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

  it("« Modifier la limitation » ne vise jamais sa propre source", () => {
    // Auto-référentiel : N recrutés produiraient N occurrences, donc une limite de base + N,
    // toujours supérieure à N - la limitation cesserait d'exister. L'éditeur interdit ce réglage ;
    // ce test verrouille le contrat côté moteur si une donnée ancienne le portait quand même.
    const cat: Catalog = {
      ...catalog,
      profiles: catalog.profiles.map((p) =>
        p.id !== "kherops-lieutenant-2"
          ? p
          : { ...p, effects: (p.effects ?? []).map((e) => ({ ...e, target: { self: true } })) },
      ),
    };
    const four = [g1(), g1(), g1(), g1(), inst("kherops-lieutenant-2")];
    const res = evaluateList(cat, makeList(four, "kherops", "bataille"));
    expect(res.limitBonuses["kherops-guerrier-1#1"]).toBeUndefined();
    expect(res.issues.some((i) => i.ruleId === "limitation:kherops-guerrier-1#1")).toBe(true);
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

  it("une Affinité octroyée par effet compte autant qu'une Affinité imprimée", () => {
    const g = catalog.profiles.find((p) => p.id === "tembos-guerriere-1")!;
    expect(affinityWays(catalog, g, [{ skillId: "affinite", value: "Shamanisme" }])).toEqual(["shamanisme"]);
  });

  it("une Affinité sans école (valeur vide) n'ouvre rien", () => {
    const g = catalog.profiles.find((p) => p.id === "tembos-guerriere-1")!;
    expect(affinityWays(catalog, { ...g, skills: [{ skillId: "affinite" }] })).toEqual([]);
    expect(affinityWays(catalog, g, [{ skillId: "affinite" }])).toEqual([]);
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

  it("l'affinité n'annule PAS les réserves profil/trait plus fines", () => {
    const spells = castableSpells(benched, nephtys, new Set(nephtys.traits), [ADANSONIA]).map((s) => s.id);
    expect(spells).toContain("guerison-vegetale"); // sa voie Adansonia (rés. khemiste) ✓
    expect(spells).toContain("banc-shamanisme"); // école ouverte par l'Affinité ✓
    expect(spells).not.toContain("banc-shamanisme-reserve"); // ... mais la réserve de trait tient ✗
  });

  it("Néphtys voit le sort de banc shamanisme via son Affinité (non réservé) + celui d'Adansonia (voie maîtrisée)", () => {
    const spells = castableSpells(benched, nephtys, new Set(nephtys.traits), [ADANSONIA]).map((s) => s.id);
    expect(spells).toContain("banc-shamanisme"); // école ouverte par l'Affinité
    expect(spells).toContain("banc-adansonia"); // sa voie maîtrisée
  });
});

describe("Archimage (maîtrise de toutes les voies)", () => {
  const balthus = catalog.profiles.find((p) => p.id === "profile-1785427326487")!;
  /** L'objet qui octroie « Archimage » à son porteur (réservé à Balthus). */
  const GRIMOIRE_JOSEVE = "equip-1785427673889";
  const allWays = catalog.magicWays.map((w) => w.id);

  it("la compétence se suffit à elle-même : toutes les voies, sans compétence d'école", () => {
    const p = { ...balthus, skills: [{ skillId: "archimage" }] };
    expect(castWays(catalog, p, inst(p.id), new Set(p.traits))).toEqual(allWays);
  });

  it("un archimage voit les sorts de toutes les voies, mais les réservations tiennent", () => {
    const p = { ...balthus, skills: [{ skillId: "archimage" }], traits: [] };
    const ways = castWays(benched, p, inst(p.id), new Set(p.traits));
    const spells = castableSpells(benched, p, new Set(p.traits), ways).map((s) => s.id);
    expect(spells).toContain("banc-shamanisme"); // voie goûne
    expect(spells).toContain("banc-adansonia"); // voie tembo
    expect(spells).not.toContain("banc-shamanisme-reserve"); // réservée à un trait qu'il n'a pas
  });

  it("le Grimoire de Josève fait de Balthus un archimage (compétence octroyée par l'objet)", () => {
    const b = inst(balthus.id, { addedEquipmentIds: [GRIMOIRE_JOSEVE] });
    const res = evaluateList(catalog, makeList([b], "kharns"));
    const granted = (res.grantedSkills[b.instanceId] ?? []).map((s) => s.skillId);
    expect(granted).toContain("archimage");
    expect(castWays(catalog, balthus, b, new Set(balthus.traits), granted)).toEqual(allWays);
  });

  it("sans le grimoire, Balthus reste cantonné à sa seule voie", () => {
    const b = inst(balthus.id);
    expect(castWays(catalog, balthus, b, new Set(balthus.traits))).toEqual(["sang-et-acier"]);
  });

  it("retirer le grimoire rend illégaux les sorts qu'il avait ouverts", () => {
    const POIGNE = "spell-1785238451420"; // Ostéomancie, 1 page, sans réservation
    const armed = inst(balthus.id, {
      addedEquipmentIds: [GRIMOIRE_JOSEVE],
      grimoireId: "grand",
      spellIds: [POIGNE],
    });
    const ok = evaluateList(catalog, makeList([armed], "kharns"));
    expect(ok.issues.map((i) => i.ruleId)).not.toContain("spell-not-castable");

    // Même figurine, objet revendu : la voie ostéomancienne se referme sur un sort déjà choisi.
    const disarmed = inst(balthus.id, { grimoireId: "grand", spellIds: [POIGNE] });
    const ko = evaluateList(catalog, makeList([disarmed], "kharns"));
    const issue = ko.issues.find((i) => i.ruleId === "spell-not-castable");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("Poigne spectrale");
  });
});

describe("réservation des sorts génériques", () => {
  const bharbathos = catalog.profiles.find((p) => p.id === "guilde-noire-bharbathos-3")!;
  const nephtys = catalog.profiles.find((p) => p.id === "tembos-nephtys-3")!;
  // Chaque mage avec sa propre voie maîtrisée : sans voie, une figurine ne lance rien du tout.
  const spellsOf = (cat: Catalog, p: typeof bharbathos, ways: string[]) =>
    castableSpells(cat, p, new Set(p.traits), ways).map((s) => s.id);

  it("un générique réservé à un personnage n'apparaît que chez lui", () => {
    expect(spellsOf(catalog, bharbathos, ["osteomancie"])).toContain("guilde-noire-passe-passe");
    expect(spellsOf(catalog, nephtys, ["way-1783500043343"])).not.toContain("guilde-noire-passe-passe");
  });

  it("un générique sans réservation reste ouvert à tous les lanceurs", () => {
    expect(spellsOf(catalog, nephtys, ["way-1783500043343"])).toContain("confusion");
  });

  it("une figurine sans voie maîtrisée ne voit aucun sort, pas même un générique", () => {
    const larbin = catalog.profiles.find((p) => p.id === "fangs-larbin-1")!;
    expect(castableSpells(catalog, larbin, new Set(larbin.traits), [])).toEqual([]);
  });

  it("une réservation de faction filtre sur la faction du profil", () => {
    const reserve: Catalog = {
      ...catalog,
      spells: catalog.spells.map((s) =>
        s.id === "confusion" ? { ...s, reservedTo: { factionIds: ["guilde-noire"] } } : s,
      ),
    };
    expect(spellsOf(reserve, bharbathos, ["osteomancie"])).toContain("confusion");
    expect(spellsOf(reserve, nephtys, ["way-1783500043343"])).not.toContain("confusion");
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
    const i = mk({ spellIds: ["drain-d-energie", "confiance-partagee", "guerison-vegetale", "banc-adansonia"] });
    const a = pageAllocation(benched, nephtys, i, traits);
    expect(a.pools.find((p) => p.wayId === ADANSONIA)?.used).toBe(5); // pool saturé
    expect(a.general.used).toBe(1); // surplus
    expect(a.over).toBe(true);
  });

  it("un petit grimoire (général 5) absorbe le surplus → redevient valide", () => {
    const i = mk({
      grimoireId: "petit",
      spellIds: ["drain-d-energie", "confiance-partagee", "guerison-vegetale", "banc-adansonia"],
    });
    const a = pageAllocation(benched, nephtys, i, traits);
    expect(a.general.cap).toBe(5);
    expect(a.general.used).toBe(1);
    expect(a.over).toBe(false);
  });

  it("les pools sont indépendants : un sort shamanisme ne consomme pas le pool Adansonia", () => {
    const a = pageAllocation(benched, nephtys, mk({ spellIds: ["banc-shamanisme"] }), traits);
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

describe("Apatride : la compétence de la carte, et rien d'autre", () => {
  const factionIssues = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("faction:"));
  const gaal = catalog.profiles.find((p) => p.id === "tembos-gaal-3")!;
  /** Le même profil dépouillé de sa compétence : un trait homonyme ne doit plus rien racheter. */
  const sansCompetence: Catalog = {
    ...catalog,
    profiles: catalog.profiles.map((p) =>
      p.id === "tembos-gaal-3"
        ? { ...p, skills: p.skills.filter((s) => s.skillId !== "apatride"), traits: [...p.traits, "apatride"] }
        : p,
    ),
  };

  it("la compétence ouvre le roster de toutes les factions", () => {
    expect(recruitableWithoutSeal(catalog, gaal, "fangs")).toBe(true);
    expect(recruitableWithoutSeal(catalog, gaal, "tembos")).toBe(true);
  });

  it("la compétence suffit au recrutement hors de sa faction", () => {
    const res = evaluateList(catalog, makeList([inst("tembos-gaal-3")], "fangs"));
    expect(factionIssues(res)).toHaveLength(0);
  });

  it("le trait seul ne recrute plus personne hors de sa faction", () => {
    const sansSkill = sansCompetence.profiles.find((p) => p.id === "tembos-gaal-3")!;
    expect(recruitableWithoutSeal(sansCompetence, sansSkill, "fangs")).toBe(false);
    const res = evaluateList(sansCompetence, makeList([inst("tembos-gaal-3")], "fangs"));
    expect(factionIssues(res)).toHaveLength(1);
  });
});

describe("Frères d'Armes (apatride conditionnel)", () => {
  const hasApatride = (res: ReturnType<typeof evaluateList>, id: string) =>
    (res.grantedSkills[id] ?? []).some((s) => s.skillId === "apatride");
  const factionIssues = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("faction:"));

  it("2 frères d'armes dans un Fer de Lance non-GN → tous apatrides, recrutement valide", () => {
    const a = inst("guilde-noire-mathys-3");
    const b = inst("guilde-noire-kaito-2");
    const res = evaluateList(catalog, makeList([a, b], "kharns"));
    expect(hasApatride(res, a.instanceId)).toBe(true);
    expect(hasApatride(res, b.instanceId)).toBe(true);
    expect(factionIssues(res)).toHaveLength(0);
  });

  it("un frère d'armes isolé dans un Fer de Lance non-GN → pas d'apatride, recrutement invalide", () => {
    const a = inst("guilde-noire-mathys-3");
    const res = evaluateList(catalog, makeList([a], "kharns"));
    expect(hasApatride(res, a.instanceId)).toBe(false);
    expect(factionIssues(res)).toHaveLength(1);
  });

  it("un « Allié des X » ne peut rejoindre que sa faction d'origine", () => {
    const inKharns = evaluateList(catalog, makeList([inst("guilde-noire-negociateur-2")], "kharns"));
    expect(factionIssues(inKharns)).toHaveLength(0);
    const inGouns = evaluateList(catalog, makeList([inst("guilde-noire-negociateur-2")], "gouns"));
    expect(factionIssues(inGouns)).toHaveLength(1);
  });

  const ATOUTS = "guilde-noire-atouts-de-mathys";
  const granted = (res: ReturnType<typeof evaluateList>, id: string) =>
    (res.grantedSkills[id] ?? []).map((s) => s.skillId);

  it("Inspiration (Atouts de Mathys, Mathys leader) redistribue à tous les frères les compétences en présence", () => {
    const m = inst("guilde-noire-mathys-3", { specialCardIds: [ATOUTS] });
    const b = inst("guilde-noire-bharbathos-3");
    const res = evaluateList(catalog, makeList([m, b], "guilde-noire"));
    expect(granted(res, m.instanceId)).toEqual(expect.arrayContaining(["en-eveil", "specialiste"]));
    expect(granted(res, b.instanceId)).toEqual(expect.arrayContaining(["en-eveil", "specialiste"]));
  });

  it("Inspiration s'applique sans le seuil de 2 frères (contrairement à la carte de base)", () => {
    const solo = inst("guilde-noire-mathys-3", { specialCardIds: [ATOUTS] });
    expect(granted(evaluateList(catalog, makeList([solo], "guilde-noire")), solo.instanceId)).toContain("en-eveil");
    const bare = inst("guilde-noire-mathys-3");
    expect(granted(evaluateList(catalog, makeList([bare], "guilde-noire")), bare.instanceId)).toHaveLength(0);
  });

  it("Inspiration ne s'active pas si Mathys n'est pas leader", () => {
    const m = inst("guilde-noire-mathys-3", { specialCardIds: [ATOUTS] });
    const b = inst("guilde-noire-bharbathos-3");
    const res = evaluateList(catalog, makeList([b, m], "guilde-noire")); // leader = Bharbathos
    expect(granted(res, m.instanceId)).not.toContain("specialiste");
  });
});

describe("Équipement de base non retirable", () => {
  // Une figurine dont deux objets de base au moins sont distincts : le premier est soudé à elle.
  const base = catalog.profiles.find(
    (p) => new Set(p.baseEquipmentIds).size >= 2 && p.baseEquipmentIds.length >= 2,
  )!;
  const [fixedId, freeId] = [...new Set(base.baseEquipmentIds)];
  const withFixed: Catalog = {
    ...catalog,
    profiles: catalog.profiles.map((p) =>
      p.id === base.id ? { ...p, fixedBaseEquipmentIds: [fixedId] } : p,
    ),
  };
  const faction = base.factionId ?? "fangs";

  it("rendre un objet de base ordinaire reste permis, et rembourse", () => {
    const a = inst(base.id, { removedBaseEquipmentIds: [freeId] });
    const res = evaluateList(withFixed, makeList([a], faction));
    expect(res.issues.filter((i) => i.ruleId?.startsWith("fixed-base-"))).toHaveLength(0);
    const refund = catalog.equipment.find((e) => e.id === freeId)!.cost;
    expect(res.costByInstance[a.instanceId]).toBe(base.cost - refund);
  });

  it("rendre un objet de base soudé à la figurine est signalé", () => {
    const a = inst(base.id, { removedBaseEquipmentIds: [fixedId] });
    const res = evaluateList(withFixed, makeList([a], faction));
    expect(res.issues.filter((i) => i.ruleId === `fixed-base-${fixedId}`)).toHaveLength(1);
  });

  it("sans marquage, aucun objet de base n'est soudé", () => {
    const a = inst(base.id, { removedBaseEquipmentIds: [fixedId] });
    const res = evaluateList(catalog, makeList([a], faction));
    expect(res.issues.filter((i) => i.ruleId?.startsWith("fixed-base-"))).toHaveLength(0);
  });
});

describe("Objets empilables (plusieurs exemplaires)", () => {
  // La Camériste porte trois doses de poison : le catalogue les replie en un objet ×3.
  const porteuse = catalog.profiles.find((p) => p.baseEquipmentCounts != null)!;
  const [stackedId] = Object.keys(porteuse.baseEquipmentCounts!);
  const qty = porteuse.baseEquipmentCounts![stackedId];
  const unitCost = catalog.equipment.find((e) => e.id === stackedId)!.cost;
  const faction = porteuse.factionId ?? "fangs";

  it("le catalogue porte bien le cas signalé : un objet de base en plusieurs exemplaires", () => {
    expect(qty).toBeGreaterThan(1);
    expect(catalog.equipment.find((e) => e.id === stackedId)?.stackable).toBe(true);
  });

  it("rendre l'objet de base rembourse tous les exemplaires", () => {
    const a = inst(porteuse.id, { removedBaseEquipmentIds: [stackedId] });
    const res = evaluateList(catalog, makeList([a], faction));
    expect(res.costByInstance[a.instanceId]).toBe(porteuse.cost - unitCost * qty);
  });

  it("l'achat facture autant d'exemplaires que la quantité demandée", () => {
    const un = inst(porteuse.id, { addedEquipmentIds: [stackedId] });
    const trois = inst(porteuse.id, {
      addedEquipmentIds: [stackedId],
      addedEquipmentCounts: { [stackedId]: 3 },
    });
    const res = evaluateList(catalog, makeList([un, trois], faction));
    expect(res.costByInstance[un.instanceId]).toBe(porteuse.cost + unitCost);
    expect(res.costByInstance[trois.instanceId]).toBe(porteuse.cost + unitCost * 3);
  });

  it("une liste ancienne, qui répétait l'identifiant, coûte toujours pareil", () => {
    const a = inst(porteuse.id, { addedEquipmentIds: [stackedId, stackedId] });
    const res = evaluateList(catalog, makeList([a], faction));
    expect(res.costByInstance[a.instanceId]).toBe(porteuse.cost + unitCost * 2);
  });
});

describe("Sceau de la guilde noire (recrutement inter-factions payant)", () => {
  const SEAL = "sceau-de-la-guilde-noire";
  const sealCost = catalog.equipment.find((e) => e.id === SEAL)!.cost;
  const factionIssues = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("faction:"));
  const raimbert = () => catalog.profiles.find((p) => p.id === "guilde-noire-raimbert-2")!;

  it("sans sceau, un membre GN ne peut pas rejoindre un Fer de Lance étranger", () => {
    const a = inst("guilde-noire-raimbert-2");
    const res = evaluateList(catalog, makeList([a], "kharns"));
    expect(factionIssues(res)).toHaveLength(1);
    expect(factionIssues(res)[0].message).toContain("Sceau de la guilde noire");
  });

  it("avec le sceau, il est recruté pour son coût majoré du sceau", () => {
    const a = inst("guilde-noire-raimbert-2", { addedEquipmentIds: [SEAL] });
    const res = evaluateList(catalog, makeList([a], "kharns"));
    expect(factionIssues(res)).toHaveLength(0);
    expect((res.grantedSkills[a.instanceId] ?? []).map((s) => s.skillId)).toContain("apatride");
    expect(res.costByInstance[a.instanceId]).toBe(raimbert().cost + sealCost);
  });

  it("un frère d'armes isolé devient recrutable grâce au sceau", () => {
    const seul = inst("guilde-noire-mathys-3");
    expect(factionIssues(evaluateList(catalog, makeList([seul], "kharns")))).toHaveLength(1);
    const scelle = inst("guilde-noire-mathys-3", { addedEquipmentIds: [SEAL] });
    expect(factionIssues(evaluateList(catalog, makeList([scelle], "kharns")))).toHaveLength(0);
  });

  it("le message d'un frère isolé rappelle ses deux issues", () => {
    const res = evaluateList(catalog, makeList([inst("guilde-noire-mathys-3")], "kharns"));
    expect(factionIssues(res)[0].message).toContain("frère d'armes");
    expect(factionIssues(res)[0].message).toContain("Sceau de la guilde noire");
  });

  it("le sceau est réservé à la Guilde Noire : porté par un autre, il est signalé", () => {
    const kharn = inst("kharns-guerrier-1", { addedEquipmentIds: [SEAL] });
    const res = evaluateList(catalog, makeList([kharn], "kharns"));
    expect(res.issues.some((i) => i.ruleId === `reserved-${SEAL}`)).toBe(true);
  });
});

describe("Montures par origine (Guilde Noire)", () => {
  const mountTypes = (profileId: string) => {
    const p = catalog.profiles.find((x) => x.id === profileId)!;
    return [...new Set(eligibleMountsFor(catalog, p).map((m) => m.typeId))].sort();
  };

  it("un GN d'origine khârne accède au Quagga (trait monture-kharns)", () => {
    expect(mountTypes("guilde-noire-mathys-3")).toEqual(["quagga"]);
  });

  it("un GN d'origine khéropse accède au Kœlod, pas au Quagga", () => {
    expect(mountTypes("guilde-noire-brute-2")).toEqual(["koelod"]);
  });

  it("un GN d'origine goûne accède aux montures goûnes (Mochères)", () => {
    // Le catalogue en compte plusieurs (Mochère, Mochère de combat) : c'est l'origine qui compte.
    const types = mountTypes("guilde-noire-gakere-2").map((id) => catalog.mountTypes.find((t) => t.id === id)!);
    expect(types.length).toBeGreaterThan(0);
    expect(types.every((t) => t.factionEligibility?.includes("gouns"))).toBe(true);
  });

  it("un GN d'origine fang n'a aucune monture (les Fangs n'en ont pas)", () => {
    expect(mountTypes("guilde-noire-bharbathos-3")).toEqual([]);
  });

  it("Berserker (Sükh) n'a aucune monture malgré son origine khéropse", () => {
    expect(mountTypes("guilde-noire-sukh-2")).toEqual([]);
  });
});

describe("améliorations intrinsèques d'un objet", () => {
  const epee = () => catalog.equipment.find((e) => e.id === "epee-courte")!;
  const upgrade = () => epee().upgrades![0];

  it("le catalogue porte bien le cas signalé : une arme gratuite avec une option payante", () => {
    expect(epee().cost).toBe(0);
    expect(upgrade().cost).toBeGreaterThan(0);
    expect(epee().mountEquipment).toBeUndefined(); // équipement de figurine, pas de monture
  });

  it("elle est proposée à l'achat, au même titre qu'une amélioration octroyée", () => {
    const proposed = upgradesForEquipment(epee(), []);
    expect(proposed.map((u) => u.id)).toContain(upgrade().id);
  });

  it("son coût s'ajoute à celui de la figurine une fois cochée", () => {
    const base = inst("fangs-goulue-1", { addedEquipmentIds: ["epee-courte"] });
    const avec = inst("fangs-goulue-1", {
      addedEquipmentIds: ["epee-courte"],
      equipmentUpgrades: { "epee-courte": [upgrade().id] },
    });
    const sansCoche = evalFang([base]).costByInstance[base.instanceId];
    const avecCoche = evalFang([avec]).costByInstance[avec.instanceId];
    expect(avecCoche - sansCoche).toBe(upgrade().cost);
  });

  it("n'est pas facturée si l'objet n'est pas porté", () => {
    const sansArme = inst("fangs-goulue-1", { equipmentUpgrades: { "epee-courte": [upgrade().id] } });
    const nu = inst("fangs-goulue-1");
    expect(evalFang([sansArme]).costByInstance[sansArme.instanceId]).toBe(
      evalFang([nu]).costByInstance[nu.instanceId],
    );
  });

  it("une intrisèque homonyme d'une octroyée n'est comptée qu'une fois", () => {
    const octroyee = { upgradeId: upgrade().id, label: "Doublon", cost: 99, equipmentCategories: ["arme-cac"] };
    const proposed = upgradesForEquipment(epee(), [octroyee]);
    expect(proposed.filter((u) => u.id === upgrade().id)).toHaveLength(1);
    expect(proposed.find((u) => u.id === upgrade().id)!.cost).toBe(upgrade().cost);
  });
});

describe("Esclaves (LDR Saison 2, p. 10)", () => {
  const PORTEUSE = "profile-1785418323892"; // Porteuse d'eau, goûne, 40 Ko, seule esclave du catalogue
  const GOURDIN = "gourdin"; // arme de corps à corps gratuite
  /**
   * Le catalogue livré ne porte pas encore la contrainte (elle se pose dans l'admin). On l'y greffe
   * ici, telle qu'elle doit être saisie : esclave partout sauf chez les Goûns et les Tembos, une
   * seule par Seigneur de guerre.
   */
  const withSlaveRule = (params: Record<string, unknown>): Catalog => ({
    ...catalog,
    profiles: catalog.profiles.map((p) =>
      p.id === PORTEUSE
        ? {
            ...p,
            recruitment: [
              {
                id: "c-slave",
                type: "slave" as const,
                params,
                scope: "fer-de-lance" as const,
                sourceText: "Esclave, hors Goûns et Tembos. Limitée à 1 par allié possédant « SDG ».",
              },
            ],
          }
        : p,
    ),
  });
  const carte = withSlaveRule({ exceptFactions: ["gouns", "tembos"], perCarrierMax: 1 });
  /** La même sans plafond de carte : sert à éprouver la règle générale (≤ valeur de SDG). */
  const sansPlafond = withSlaveRule({ exceptFactions: ["gouns", "tembos"] });
  const porteuse = carte.profiles.find((p) => p.id === PORTEUSE)!;
  const slaveIssues = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("slave-"));

  it("la condition dépend du Fer de Lance d'accueil", () => {
    expect(isSlaveIn(porteuse, "kharns")).toBe(true);
    expect(isSlaveIn(porteuse, "gouns")).toBe(false);
    expect(isSlaveIn(porteuse, "tembos")).toBe(false);
  });

  it("possédée par un Seigneur de guerre, elle est recrutée sans faute", () => {
    const esclave = inst(PORTEUSE);
    const sdg = inst("fangs-broutcha-2", { attachedInstanceIds: [esclave.instanceId] });
    const res = evaluateList(carte, makeList([sdg, esclave, inst("fangs-goulue-1")], "fangs"));
    expect(slaveIssues(res)).toEqual([]);
  });

  it("sans Seigneur de guerre, elle est refusée", () => {
    const esclave = inst(PORTEUSE);
    const res = evaluateList(carte, makeList([inst("fangs-goulue-1"), esclave, inst("fangs-goulue-1")], "fangs"));
    expect(slaveIssues(res).map((i) => i.ruleId)).toEqual(["slave-no-warlord"]);
  });

  it("rattachée à une figurine sans SDG, elle est refusée aussi", () => {
    const esclave = inst(PORTEUSE);
    const porteur = inst("fangs-goulue-1", { attachedInstanceIds: [esclave.instanceId] });
    const res = evaluateList(carte, makeList([porteur, esclave, inst("fangs-goulue-1")], "fangs"));
    expect(slaveIssues(res).map((i) => i.ruleId)).toEqual(["slave-no-warlord"]);
  });

  it("la carte peut resserrer le plafond du porteur (1 par SDG)", () => {
    const a = inst(PORTEUSE);
    const b = inst(PORTEUSE);
    // Balthus a SDG 5 : la règle générale l'autoriserait, mais sa carte à elle n'en tolère qu'une.
    const balthus = inst("profile-1785427326487", { attachedInstanceIds: [a.instanceId, b.instanceId] });
    const others = [inst("kharns-syrga"), inst("kharns-syrga")];
    const res = evaluateList(carte, makeList([balthus, a, b, ...others], "kharns"));
    expect(slaveIssues(res).map((i) => i.ruleId)).toContain("slave-over-warlord-capacity");
  });

  it("sans plafond de carte, le porteur en possède autant que sa valeur de SDG", () => {
    const a = inst(PORTEUSE);
    const b = inst(PORTEUSE);
    const balthus = inst("profile-1785427326487", { attachedInstanceIds: [a.instanceId, b.instanceId] });
    const others = [inst("kharns-syrga"), inst("kharns-syrga")];
    expect(slaveIssues(evaluateList(sansPlafond, makeList([balthus, a, b, ...others], "kharns")))).toEqual([]);

    // Syrga n'a que SDG 1 : deux esclaves, c'est une de trop.
    const c = inst(PORTEUSE);
    const d = inst(PORTEUSE);
    const syrga = inst("kharns-syrga", { attachedInstanceIds: [c.instanceId, d.instanceId] });
    const res = evaluateList(sansPlafond, makeList([syrga, c, d, inst("kharns-syrga"), inst("kharns-syrga")], "kharns"));
    expect(slaveIssues(res).map((i) => i.ruleId)).toEqual(["slave-over-warlord-capacity"]);
  });

  it("les esclaves ne dépassent jamais en nombre les autres combattants", () => {
    const a = inst(PORTEUSE);
    const b = inst(PORTEUSE);
    const balthus = inst("profile-1785427326487", { attachedInstanceIds: [a.instanceId, b.instanceId] });
    // 2 esclaves pour 1 autre combattant → refusé ; en ajoutant un second Khârn, 2 pour 2 → accepté.
    const trop = evaluateList(sansPlafond, makeList([balthus, a, b], "kharns"));
    expect(slaveIssues(trop).map((i) => i.ruleId)).toContain("slave-outnumber");
    const ok = evaluateList(sansPlafond, makeList([balthus, a, b, inst("kharns-syrga")], "kharns"));
    expect(slaveIssues(ok)).toEqual([]);
  });

  it("elle n'achète qu'une arme de corps à corps gratuite", () => {
    const armee = (equip: string[]) => {
      const esclave = inst(PORTEUSE, { addedEquipmentIds: equip });
      const sdg = inst("fangs-broutcha-2", { attachedInstanceIds: [esclave.instanceId] });
      return evaluateList(carte, makeList([sdg, esclave, inst("fangs-goulue-1")], "fangs"));
    };
    expect(slaveIssues(armee([GOURDIN]))).toEqual([]);
    expect(slaveIssues(armee(["epee-longue"])).map((i) => i.ruleId)).toEqual(["slave-equipment"]);
  });

  it("un esclave ne mène pas un Fer de Lance", () => {
    const esclave = inst(PORTEUSE);
    const sdg = inst("fangs-broutcha-2", { attachedInstanceIds: [esclave.instanceId] });
    // `makeList` désigne le premier membre comme meneur : on met l'esclave en tête.
    const res = evaluateList(carte, makeList([esclave, sdg, inst("fangs-goulue-1")], "fangs"));
    expect(res.issues.filter((i) => i.ruleId === "leader-eligibility")).toHaveLength(1);
  });

  it("sa condition lui tient lieu de laissez-passer inter-factions", () => {
    const esclave = inst(PORTEUSE); // goûne, dans un Fer de Lance khârn
    const balthus = inst("profile-1785427326487", { attachedInstanceIds: [esclave.instanceId] });
    const res = evaluateList(carte, makeList([balthus, esclave, inst("kharns-syrga")], "kharns"));
    expect(res.issues.filter((i) => i.ruleId?.startsWith("faction:"))).toEqual([]);
  });

  it("elle ne prend aucune amélioration payante", () => {
    // « Lien de la Terre » vise tous les Dogons, dont elle : sa carte la propose, sa condition non.
    const esclave = inst(PORTEUSE, { specialCardIds: ["lien-de-la-terre"] });
    const sdg = inst("fangs-broutcha-2", { attachedInstanceIds: [esclave.instanceId] });
    const res = evaluateList(carte, makeList([sdg, esclave, inst("fangs-goulue-1")], "fangs"));
    expect(slaveIssues(res).map((i) => i.ruleId)).toEqual(["slave-upgrade"]);
  });

  it("chez les Goûns, ce n'est plus une esclave : ni porteur, ni restriction d'équipement", () => {
    const libre = inst(PORTEUSE, { addedEquipmentIds: ["epee-longue"], specialCardIds: ["lien-de-la-terre"] });
    const res = evaluateList(carte, makeList([inst("gouns-shaman-2"), libre], "gouns"));
    expect(slaveIssues(res)).toEqual([]);
  });
});

/**
 * Identifiants du catalogue : ceux des cartes comme ceux de leurs effets sont réécrits par l'admin
 * (slug, effet re-créé). On retrouve donc l'offre par ce qu'elle FAIT, jamais par un identifiant figé.
 */
const grantEffectId = (): string =>
  catalog.specialCards
    .flatMap((c) => c.effects)
    .find((e) => e.operation.kind === "grant-spell-choice")!.id;

describe("sorts offerts au choix (grant-spell-choice)", () => {
  const DEMI_SOEUR = "profile-1785410170666";
  const GRANT = grantEffectId();
  const demiSoeur = catalog.profiles.find((p) => p.id === DEMI_SOEUR)!;
  const grantOf = (cat: Catalog = catalog) =>
    spellGrants(cat, demiSoeur, inst(DEMI_SOEUR), new Set(demiSoeur.traits))[0];

  it("la carte « Demi-soeur » ouvre une offre d'un sort d'Ostéomancie", () => {
    const g = grantOf();
    expect(g.effectId).toBe(GRANT);
    expect(g.count).toBe(1);
    expect(g.name).toBe("Demi-soeur");
  });

  it("l'offre ne connaît ni page ni niveau : sorts de grimoire et génériques de la voie s'y côtoient", () => {
    const ids = grantOf().choices.map((s) => s.id);
    expect(ids).toContain("spell-1785239128129"); // Ordre sépulcral - 3 pages
    expect(ids).toContain("spell-1785237940302"); // Poudre d'os - générique
  });

  it("les réservations tiennent : la Demi-soeur n'atteint pas les sorts des Filles de Nyx", () => {
    const ids = grantOf().choices.map((s) => s.id);
    expect(ids).not.toContain("seduction-du-fiel"); // réservé au trait « fille-de-nyx »
    expect(ids).not.toContain("guilde-noire-passe-passe"); // réservé à Bharbathos
  });

  it("le sort offert ne consomme ni page ni niveau, même sans grimoire", () => {
    // 3 pages : impossible à financer sans grimoire s'il passait par le budget général.
    const x = inst(DEMI_SOEUR, { grantedSpellIds: { [GRANT]: ["spell-1785239128129"] } });
    const res = evalFang([x]);
    expect(res.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(res.costByInstance[x.instanceId]).toBe(demiSoeur.cost);
  });

  it("le prix en Kouronnes du sort reste dû", () => {
    const payant: Spell = {
      id: "banc-osteomancie-payante",
      name: "Banc d'essai - Ostéomancie payante",
      kind: "grimoire",
      magicWayId: "osteomancie",
      pages: 2,
      cost: 10,
      target: "Soi-même",
      difficulties: [],
    };
    const cat: Catalog = { ...catalog, spells: [...catalog.spells, payant] };
    const x = inst(DEMI_SOEUR, { grantedSpellIds: { [GRANT]: [payant.id] } });
    const res = evaluateList(cat, makeList([x]));
    expect(res.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(res.costByInstance[x.instanceId]).toBe(demiSoeur.cost + 10);
  });

  it("un sort hors de la sélection est refusé", () => {
    const x = inst(DEMI_SOEUR, { grantedSpellIds: { [GRANT]: ["onde-revigorante"] } }); // shamanisme
    const res = evalFang([x]);
    expect(res.issues.map((i) => i.ruleId)).toContain("granted-spell-not-eligible");
  });

  it("le quota de l'offre est tenu", () => {
    const x = inst(DEMI_SOEUR, {
      grantedSpellIds: { [GRANT]: ["spell-1785238451420", "spell-1785238621986"] },
    });
    const res = evalFang([x]);
    expect(res.issues.map((i) => i.ruleId)).toContain("granted-spell-over-count");
  });

  it("un choix dont l'offre a disparu est signalé, pas appliqué en silence", () => {
    const x = inst(DEMI_SOEUR, { grantedSpellIds: { "effet-envole": ["spell-1785238451420"] } });
    const res = evalFang([x]);
    expect(res.issues.map((i) => i.ruleId)).toContain("granted-spell-orphan");
  });

  it("un même sort ne peut être connu deux fois (offert et payé)", () => {
    const x = inst(DEMI_SOEUR, {
      grimoireId: "grand",
      spellIds: ["spell-1785238451420"],
      grantedSpellIds: { [GRANT]: ["spell-1785238451420"] },
    });
    const res = evalFang([x]);
    expect(res.issues.map((i) => i.ruleId)).toContain("spell-duplicate");
  });

  it("une figurine sans offre n'en reçoit aucune", () => {
    const goulue = catalog.profiles.find((p) => p.id === "fangs-goulue-1")!;
    expect(spellGrants(catalog, goulue, inst(goulue.id), new Set(goulue.traits))).toEqual([]);
  });
});

describe("un objet qui protège sans être une armure (Vouge de Moringa)", () => {
  const VOUGE = "equip-1785436448046";
  const PATRIARCHE = "profile-1785421140855";
  const eq = (id: string) => catalog.equipment.find((e) => e.id === id)!;

  it("le rôle défensif se lit sur l'objet, pas sur sa catégorie", () => {
    expect(armorRole(eq(VOUGE))).toBe("extra"); // arme de corps à corps qui protège
    expect(armorRole(eq("gambison"))).toBe("stackable");
    expect(armorRole(eq("armure-de-cuir"))).toBe("standard");
    expect(armorRole(eq("ecu"))).toBeNull(); // bouclier : une DV, aucune protection chiffrée
  });

  it("protéger ne dépend que du seuil renseigné", () => {
    expect(protects(eq(VOUGE))).toBe(true);
    expect(protects(eq("faucille-os"))).toBe(false);
  });

  it("elle n'occupe pas l'emplacement d'armure : on peut porter une armure en plus", () => {
    const x = inst(PATRIARCHE, { addedEquipmentIds: [VOUGE, "armure-de-cuir"] });
    const res = evaluateList(catalog, makeList([x], "tembos"));
    expect(res.issues.filter((i) => i.ruleId === "multiple-armor")).toEqual([]);
  });

  it("arme au logo Tembo : son prix inclut déjà le tarif Tembo, pas de surcoût", () => {
    expect(temboEquipmentSurcharge(catalog, ["tembo"], VOUGE)).toBe(0);
    const x = inst(PATRIARCHE, { addedEquipmentIds: [VOUGE] });
    const res = evaluateList(catalog, makeList([x], "tembos"));
    const patriarche = catalog.profiles.find((p) => p.id === PATRIARCHE)!;
    expect(res.costByInstance[x.instanceId]).toBe(patriarche.cost + eq(VOUGE).cost);
  });
});

describe("recrutement ouvert (Affranchis)", () => {
  const eq = (id: string) => catalog.equipment.find((e) => e.id === id)!;
  const errs = (res: ReturnType<typeof evaluateList>, prefix: string) =>
    res.issues.filter((i) => i.ruleId?.startsWith(prefix));
  const list = (members: ProfileInstance[]) => makeList(members, "affranchis");

  it("accueille un générique d'un peuple ouvert, sans sceau ni « Allié des X »", () => {
    const res = evaluateList(catalog, list([inst("kharns-guerrier-1")]));
    expect(errs(res, "faction:")).toHaveLength(0);
    const guerrier = catalog.profiles.find((p) => p.id === "kharns-guerrier-1")!;
    expect(recruitableWithoutSeal(catalog, guerrier, "affranchis")).toBe(true);
    // Le coût annoncé reste celui de la carte : aucun sceau n'est imposé sur cette voie.
    expect(recruitCost(catalog, guerrier, "affranchis")).toBe(guerrier.cost);
  });

  it("refuse un unique ou un personnage, qui ne sont pas des génériques", () => {
    const ogodei = catalog.profiles.find((p) => p.limitation.kind === "P" && p.factionId === "kherops")!;
    expect(openRecruitmentAccepts(catalog, ogodei, "affranchis")).toBe(false);
    expect(errs(evaluateList(catalog, list([inst(ogodei.id)])), "faction:")).toHaveLength(1);
  });

  it("refuse les exclusions par trait (Ordre du Sang et de l'Acier, femelles fangs)", () => {
    for (const id of ["kharns-fidele-1", "fangs-goulue-1"]) {
      const p = catalog.profiles.find((x) => x.id === id);
      if (!p) continue;
      expect(openRecruitmentAccepts(catalog, p, "affranchis")).toBe(false);
    }
  });

  it("refuse le Bourreau du Sacrifice, exclu nommément, mais garde le Prêtre", () => {
    const bourreau = catalog.profiles.find((p) => p.id === "kherops-bourreau-2")!;
    const pretre = catalog.profiles.find((p) => p.id === "kherops-pretre-1")!;
    expect(openRecruitmentAccepts(catalog, bourreau, "affranchis")).toBe(false);
    expect(openRecruitmentAccepts(catalog, pretre, "affranchis")).toBe(true);
  });

  it("plafonne les shamans goûns à un par Fer de Lance", () => {
    const un = evaluateList(catalog, list([inst("gouns-shaman-1")]));
    expect(errs(un, "open-recruitment-cap")).toHaveLength(0);
    const deux = evaluateList(catalog, list([inst("gouns-shaman-1"), inst("gouns-shaman-1")]));
    expect(errs(deux, "open-recruitment-cap")).toHaveLength(2);
  });

  it("ne plafonne pas le même profil dans son propre Fer de Lance", () => {
    const chezEux = evaluateList(catalog, makeList([inst("gouns-shaman-1"), inst("gouns-shaman-1")], "gouns"));
    expect(errs(chezEux, "open-recruitment-cap")).toHaveLength(0);
  });

  it("prive le transfuge de l'arsenal réservé à son peuple, pas de ses autres réservations", () => {
    const guerrier = catalog.profiles.find((p) => p.id === "kharns-guerrier-1")!;
    const armure = eq("eq-armure-combat-kharne");
    expect(equipmentAllowedIn(catalog, armure, guerrier, "kharns")).toBe(true);
    expect(equipmentAllowedIn(catalog, armure, guerrier, "affranchis")).toBe(false);
    const res = evaluateList(catalog, list([inst("kharns-guerrier-1", { addedEquipmentIds: [armure.id] })]));
    expect(errs(res, `reserved-${armure.id}`)).toHaveLength(1);
  });
});

describe("cartes portées par la bannière (Affranchis)", () => {
  const COUVERT = "affranchis-couvert-des-bois";
  const AGUERRI = "affranchis-aguerri-aux-bois";
  const card = (id: string) => catalog.specialCards.find((c) => c.id === id)!;
  const guerrier = catalog.profiles.find((p) => p.id === "kharns-guerrier-2")!;

  it("« Furtivité » gagne aussi les recrues d'un autre peuple", () => {
    const x = inst("kharns-guerrier-1");
    const res = evaluateList(catalog, makeList([x], "affranchis"));
    expect(res.grantedSkills[x.instanceId]?.map((g) => g.skillId)).toContain("furtivite");
  });

  it("… mais pas dans un Fer de Lance d'un autre peuple", () => {
    const x = inst("kharns-guerrier-1");
    const res = evaluateList(catalog, makeList([x], "kharns"));
    expect(res.grantedSkills[x.instanceId]?.map((g) => g.skillId) ?? []).not.toContain("furtivite");
  });

  it("« Aguerri aux bois » coûte 5 Ko × le niveau", () => {
    expect(specialCardCost(card(AGUERRI), guerrier)).toBe(10); // niveau II
    const x = inst("kharns-guerrier-2", { specialCardIds: [AGUERRI] });
    const res = evaluateList(catalog, makeList([x], "affranchis"));
    expect(res.costByInstance[x.instanceId]).toBe(guerrier.cost + 10);
  });

  it("« Aguerri aux bois » ne s'ouvre qu'aux recrues, pas aux Affranchis d'origine", () => {
    const affranchi = { ...guerrier, id: "faux-affranchi", factionId: "affranchis" };
    expect(cardMatchesBanner(card(AGUERRI), guerrier, "affranchis")).toBe(true);
    expect(cardMatchesBanner(card(AGUERRI), affranchi, "affranchis")).toBe(false);
    // La carte automatique, elle, ne fait pas ce tri : elle vaut pour tout le Fer de Lance.
    expect(cardMatchesBanner(card(COUVERT), affranchi, "affranchis")).toBe(true);
  });
});

describe("recrutement ouvert : qui la faction refuse", () => {
  const errsFor = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("faction:"));
  const refused = (id: string) =>
    openRecruitmentRefuses(catalog, catalog.profiles.find((p) => p.id === id)!, "affranchis");

  it("refuse les uniques et les personnages des peuples accueillis, sceau compris", () => {
    // L'Agent sombre III est unique : son sceau de la Guilde Noire ne doit plus lui ouvrir la porte.
    const agent3 = catalog.profiles.find(
      (p) => p.factionId === "guilde-noire" && p.name === "Agent sombre" && p.level === 3,
    )!;
    expect(refused(agent3.id)).toBe(true);
    expect(isRecruitableIn(catalog, agent3, "affranchis")).toBe(false);
    expect(errsFor(evaluateList(catalog, makeList([inst(agent3.id)], "affranchis")))).toHaveLength(1);
    // Chez elle, rien ne change.
    expect(isRecruitableIn(catalog, agent3, "guilde-noire")).toBe(true);
  });

  it("refuse Khalsa, nommée dans les exclusions (elle a son propre profil affranchi)", () => {
    expect(refused("guilde-noire-khalsa-2")).toBe(true);
    expect(isRecruitableIn(catalog, catalog.profiles.find((p) => p.id === "guilde-noire-khalsa-2")!, "affranchis")).toBe(false);
  });

  it("laisse passer ce que la carte accorde nommément (« Allié des Affranchis »)", () => {
    const bourgmestre = catalog.profiles.find((p) => p.name === "Bourgmestre")!;
    expect(bourgmestre.limitation.kind).not.toBe("X"); // personnage : la règle générale l'écarterait
    expect(recruitableWithoutSeal(catalog, bourgmestre, "affranchis")).toBe(true);
    expect(errsFor(evaluateList(catalog, makeList([inst(bourgmestre.id)], "affranchis")))).toHaveLength(0);
  });

  it("ne dit rien des peuples que la faction n'accueille pas (un Tembo apatride entre)", () => {
    const gaal = catalog.profiles.find((p) => p.id === "tembos-gaal-3")!;
    expect(refused(gaal.id)).toBe(false);
    expect(isRecruitableIn(catalog, gaal, "affranchis")).toBe(true);
  });
});

describe("origine choisie au recrutement (Agent sombre)", () => {
  const AGENT = "profile-1785423938572"; // Agent sombre II
  const agent = catalog.profiles.find((p) => p.id === AGENT)!;
  const list = (origin?: string) =>
    makeList([inst(AGENT, origin ? { origin } : {})], "guilde-noire");
  const originErrs = (res: ReturnType<typeof evaluateList>) =>
    res.issues.filter((i) => i.ruleId?.startsWith("origin:"));
  const typesFor = (origin?: string) => [
    ...new Set(
      eligibleMountsFor(catalog, agent, effectiveOrigin(agent, { origin })).map(
        (m) => catalog.mountTypes.find((t) => t.id === m.typeId)!.name,
      ),
    ),
  ];

  it("la carte laisse le choix entre cinq peuples", () => {
    expect(needsOriginChoice(agent)).toBe(true);
    expect(agent.originChoices).toEqual(["fangs", "gouns", "kharns", "kherops", "tembos"]);
  });

  it("exige une origine, et refuse celle que la carte ne propose pas", () => {
    expect(originErrs(evaluateList(catalog, list()))).toHaveLength(1);
    expect(originErrs(evaluateList(catalog, list("affranchis")))).toHaveLength(1);
    expect(originErrs(evaluateList(catalog, list("kharns")))).toHaveLength(0);
  });

  it("ouvre la monture du peuple choisi, et elle seule", () => {
    expect(typesFor("kharns")).toEqual(["Quagga"]);
    expect(typesFor("kherops")).toEqual(["Koelod"]);
    expect(typesFor("fangs")).toEqual([]); // les Fangs n'ont pas de monture
    expect(typesFor()).toEqual([]); // sans choix, aucune
  });

  it("refuse la monture d'un autre peuple que celui choisi", () => {
    const quagga = catalog.mounts.find(
      (m) => catalog.mountTypes.find((t) => t.id === m.typeId)?.name === "Quagga" && m.level === 2,
    )!;
    const monte = (origin: string) =>
      evaluateList(
        catalog,
        makeList([inst(AGENT, { origin, mount: { mountId: quagga.id } })], "guilde-noire"),
      ).issues.filter((i) => i.ruleId?.startsWith("mount-"));
    expect(monte("kharns")).toHaveLength(0);
    expect(monte("gouns")).toHaveLength(1);
  });
});
