// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { catalog } from "@data";
import { PurchaseSummary } from "./PurchaseSummary";

afterEach(cleanup);

const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier"];

/** Props « rien d'acheté » : seul l'équipement de base d'un profil alimente le résumé. */
function baseProps(profileId: string) {
  const p = catalog.profiles.find((x) => x.id === profileId)!;
  return {
    p,
    cat: catalog,
    added: [] as string[],
    removed: [] as string[],
    spellIds: [] as string[],
    upgrades: [] as string[],
    munitions: {},
    equipmentUpgrades: {},
    grantedUpgrades: [],
    costRules: [],
  };
}

describe("PurchaseSummary (vue)", () => {
  // Profil dont l'équipement de base contient au moins une arme (pour la ligne « Armes »).
  const armed = catalog.profiles.find((p) =>
    p.baseEquipmentIds.some((id) => WEAPON_CATS.includes(catalog.equipment.find((e) => e.id === id)?.category ?? "")),
  )!;

  it("regroupe l'équipement de base sous « Armes » et nomme chaque objet", () => {
    const onPick = vi.fn();
    const { getByText, container } = render(<PurchaseSummary {...baseProps(armed.id)} onPick={onPick} />);
    expect(getByText("Armes")).toBeTruthy();
    const weapon = armed.baseEquipmentIds
      .map((id) => catalog.equipment.find((e) => e.id === id))
      .find((e) => e && WEAPON_CATS.includes(e.category))!;
    expect(getByText(weapon.name)).toBeTruthy();
    // Chaque chip est un bouton qui ouvre la fiche de l'objet.
    fireEvent.click(container.querySelector(".bld-loadout-item")!);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("ne rend rien quand il n'y a aucun achat ni équipement de base", () => {
    // Profil sans équipement de base : le panneau se replie (retourne null).
    const bare = catalog.profiles.find((p) => p.baseEquipmentIds.length === 0);
    if (!bare) return; // catalogue sans profil « nu » : rien à vérifier
    const { container } = render(<PurchaseSummary {...baseProps(bare.id)} onPick={() => {}} />);
    expect(container.querySelector(".bld-loadout")).toBeNull();
  });

  it("affiche une ligne « Magie » avec le grimoire et les sorts achetés", () => {
    const grim = catalog.grimoires[0];
    const spell = catalog.spells[0];
    const { getByText } = render(
      <PurchaseSummary
        {...baseProps(armed.id)}
        grimoireId={grim.id}
        spellIds={[spell.id]}
        onPick={() => {}}
      />,
    );
    expect(getByText("Magie")).toBeTruthy();
    expect(getByText(grim.name)).toBeTruthy();
    expect(getByText(/1 sort/)).toBeTruthy();
  });
});
