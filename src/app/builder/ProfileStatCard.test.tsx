import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { catalog } from "@data";
import { ProfileStatCard, type ProfileMods } from "./ProfileStatCard";
import { wornArmorsFrom } from "./shared";

/**
 * Tests de vue : garde-fou avant/pendant l'extraction du rendu partagé (StatSheet). Les snapshots
 * figent le HTML rendu de profils représentatifs ; ils doivent rester identiques tant que le rendu
 * n'évolue pas volontairement (un changement de snapshot = une modification visible à valider).
 */
afterEach(cleanup);

// armure · dés de maîtrise + règles + compétences · lanceur · compétence à valeur · shaman.
const REPRESENTATIVE = [
  "kharns-guerrier-1",
  "fangs-larbin-1",
  "fangs-meneuse-1",
  "kherops-guerrier-1-1",
  "gouns-shaman-2",
];

describe("ProfileStatCard (vue)", () => {
  for (const id of REPRESENTATIVE) {
    it(`rend « ${id} » de façon stable`, () => {
      const p = catalog.profiles.find((x) => x.id === id);
      expect(p, `profil ${id} introuvable`).toBeTruthy();
      const { container } = render(<ProfileStatCard p={p!} cat={catalog} onInfo={() => {}} showEquipment />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }

  // Modifications d'effets : stats/compétences en « braise » (fx), octrois, allonge de monture,
  // dé de maîtrise octroyé, bonus de limitation - tous les chemins que l'extraction du rendu touche.
  it("rend un profil avec stats et compétences modifiées (fx) de façon stable", () => {
    const p = catalog.profiles.find((x) => x.id === "kherops-guerrier-1-1")!;
    const mods: ProfileMods = {
      statDeltas: { v: 1, a: -1 },
      skillValues: { "charge-brutale": 2 }, // best-value (native 1 → 2)
      grantedSkills: [{ skillId: "endurance" }, { skillId: "specialiste", value: "attaque" }],
      grantedTraitIds: ["monté"],
      effectSources: {
        "stat:v": [{ label: "Koelod II", text: "Bonus de monture." }],
        "skill:charge-brutale": [{ label: "Koelod II", text: "Meilleure valeur." }],
      },
      mountAllonge: 0.5,
    };
    const { container } = render(<ProfileStatCard p={p} cat={catalog} onInfo={() => {}} mods={mods} showEquipment />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("rend un profil avec octrois (compétence, trait, dé, limitation) de façon stable", () => {
    const p = catalog.profiles.find((x) => x.id === "fangs-larbin-1")!;
    const mods: ProfileMods = {
      grantedSkills: [{ skillId: "endurance" }],
      grantedTraitIds: ["béni"],
      grantedMasteryDice: [[]],
      limitBonus: 1,
    };
    const { container } = render(<ProfileStatCard p={p} cat={catalog} onInfo={() => {}} mods={mods} showEquipment />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("affiche une armure portée (Brigandine) en plus de l'armure innée", () => {
    const p = catalog.profiles.find((x) => x.id === "kherops-capitaine-2")!;
    const worn = wornArmorsFrom(catalog, p.baseEquipmentIds);
    expect(worn.length, "kherops-capitaine-2 devrait porter une armure de base").toBeGreaterThan(0);
    const { container } = render(
      <ProfileStatCard p={p} cat={catalog} onInfo={() => {}} wornArmors={worn} showEquipment />,
    );
    expect(container.querySelector(".fe-armor")).toBeTruthy();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("rend tous les profils du catalogue sans planter", () => {
    for (const p of catalog.profiles) {
      expect(() => {
        const { unmount } = render(<ProfileStatCard p={p} cat={catalog} onInfo={() => {}} showEquipment />);
        unmount();
      }, `échec de rendu pour ${p.id}`).not.toThrow();
    }
  });
});
