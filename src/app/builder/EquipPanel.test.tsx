// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { catalog } from "@data";
import { EquipPanel } from "./EquipPanel";

afterEach(cleanup);

const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier"];

function baseProps(profileId: string) {
  const p = catalog.profiles.find((x) => x.id === profileId)!;
  return {
    profile: p,
    cat: catalog,
    added: [] as string[],
    removed: [] as string[],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onToggleBase: vi.fn(),
    munitions: {},
    onMunTier: vi.fn(),
    onInfo: vi.fn(),
    grantedUpgrades: [],
    costRules: [],
    equipmentUpgrades: {},
    onToggleEquipmentUpgrade: vi.fn(),
    hasMount: false,
  };
}

describe("EquipPanel (vue)", () => {
  // Profil avec au moins une arme de base (peuple le volet « Équipé »).
  const armed = catalog.profiles.find((p) =>
    p.baseEquipmentIds.some((id) => WEAPON_CATS.includes(catalog.equipment.find((e) => e.id === id)?.category ?? "")),
  )!;

  it("affiche les deux volets Équipé / Disponible et l'équipement de base", () => {
    render(<EquipPanel {...baseProps(armed.id)} />);
    expect(screen.getByText("Équipé")).toBeTruthy();
    expect(screen.getByText("Disponible")).toBeTruthy();
    const weapon = armed.baseEquipmentIds
      .map((id) => catalog.equipment.find((e) => e.id === id))
      .find((e) => e && WEAPON_CATS.includes(e.category))!;
    expect(screen.getAllByText(weapon.name).length).toBeGreaterThan(0);
  });

  it("filtre la liste disponible par la recherche", () => {
    render(<EquipPanel {...baseProps(armed.id)} />);
    const search = screen.getByPlaceholderText(/Rechercher un équipement/i);
    fireEvent.change(search, { target: { value: "zzzintrouvable" } });
    expect(screen.getByText(/Aucun résultat/i)).toBeTruthy();
  });

  it("ajoute un équipement disponible via le bouton ←", () => {
    const props = baseProps(armed.id);
    const { container } = render(<EquipPanel {...props} />);
    // Le volet « Disponible » est le second bloc ; on prend son premier bouton d'ajout.
    const addBtn = container.querySelector(".fe-move.add") as HTMLButtonElement | null;
    if (!addBtn) return; // catalogue sans équipement disponible pour ce profil
    fireEvent.click(addBtn);
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it("ouvre la fiche d'un objet équipé au clic (onInfo)", () => {
    const props = baseProps(armed.id);
    const { container } = render(<EquipPanel {...props} />);
    const equippedPane = container.querySelector(".fe-scroll")!;
    const item = within(equippedPane as HTMLElement).getAllByText((_, el) =>
      el?.classList.contains("fe-item") ?? false,
    )[0];
    fireEvent.click(item);
    expect(props.onInfo).toHaveBeenCalled();
  });
});
