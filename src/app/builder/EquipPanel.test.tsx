// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { catalog } from "@data";
import { EquipPanel } from "./EquipPanel";

afterEach(cleanup);

const WEAPON_CATS = ["arme-cac", "arme-tir", "bouclier"];

function baseProps(profileId: string, factionId = "fangs") {
  const p = catalog.profiles.find((x) => x.id === profileId)!;
  return {
    profile: p,
    cat: catalog,
    factionId,
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

  // Sceau de la guilde noire : imposé (donc verrouillé) aux membres GN recrutés ailleurs,
  // facultatif pour un frère d'armes, sans objet dans un Fer de Lance Guilde Noire.
  const SEAL = catalog.equipment.find((e) => e.id === "sceau-de-la-guilde-noire")!;

  it("verrouille le sceau imposé : pas de bouton « retirer » sur cet objet", () => {
    const props = { ...baseProps("guilde-noire-raimbert-2", "kharns"), added: [SEAL.id] };
    const { container } = render(<EquipPanel {...props} />);
    const locked = container.querySelector(".fe-move.is-locked");
    expect(locked).toBeTruthy();
    // La ligne du sceau n'offre aucun bouton de retrait.
    const row = locked!.closest(".fe-item")!;
    expect(within(row as HTMLElement).queryByText(SEAL.name)).toBeTruthy();
    expect(row.querySelector(".fe-move.rem")).toBeNull();
  });

  it("propose le sceau à l'achat pour un frère d'armes hors de sa faction", () => {
    render(<EquipPanel {...baseProps("guilde-noire-mathys-3", "kharns")} />);
    expect(screen.getAllByText(SEAL.name).length).toBeGreaterThan(0);
  });

  it("ne propose pas le sceau dans un Fer de Lance Guilde Noire", () => {
    render(<EquipPanel {...baseProps("guilde-noire-raimbert-2", "guilde-noire")} />);
    expect(screen.queryByText(SEAL.name)).toBeNull();
  });

  it("verrouille un équipement de base marqué non retirable, pas les autres", () => {
    const p = catalog.profiles.find((x) => new Set(x.baseEquipmentIds).size >= 2)!;
    const [fixedId, freeId] = [...new Set(p.baseEquipmentIds)];
    const props = { ...baseProps(p.id), profile: { ...p, fixedBaseEquipmentIds: [fixedId] } };
    const { container } = render(<EquipPanel {...props} />);
    const rowOf = (id: string) => {
      const name = catalog.equipment.find((e) => e.id === id)!.name;
      return [...container.querySelectorAll(".fe-item")].find((el) => el.textContent?.includes(name))!;
    };
    expect(rowOf(fixedId).querySelector(".fe-move.is-locked")).toBeTruthy();
    expect(rowOf(fixedId).querySelector(".fe-move.rem")).toBeNull();
    expect(rowOf(freeId).querySelector(".fe-move.rem")).toBeTruthy();
  });

  // Depuis la suppression de la déduction « porté par un seul profil », seule la réservation
  // inscrite sur l'objet restreint l'achat.
  it("propose un objet sans réservation, même s'il n'est porté que par une figurine", () => {
    const solo = catalog.equipment.find(
      (e) =>
        e.category === "arme-cac" &&
        e.reservedTo == null &&
        catalog.profiles.filter((p) => p.baseEquipmentIds.includes(e.id)).length === 1,
    )!;
    // Une Goulue : d'une autre faction que le porteur, et libre d'acheter des armes.
    render(<EquipPanel {...baseProps("fangs-goulue-1")} />);
    expect(screen.getAllByText(solo.name).length).toBeGreaterThan(0);
  });

  it("ne propose pas un objet réservé à un autre personnage", () => {
    const reserve = catalog.equipment.find((e) => (e.reservedTo?.profileIds?.length ?? 0) > 0)!;
    const autre = catalog.profiles.find(
      (p) => !reserve.reservedTo!.profileIds!.includes(p.id) && !p.baseEquipmentIds.includes(reserve.id),
    )!;
    render(<EquipPanel {...baseProps(autre.id)} />);
    expect(screen.queryByText(reserve.name)).toBeNull();
  });

  it("annonce le prix d'un objet empilable à l'unité", () => {
    const stacked = catalog.equipment.find((e) => e.stackable && e.cost > 0)!;
    render(<EquipPanel {...baseProps("fangs-goulue-1")} />);
    const row = [...screen.getAllByText(stacked.name)][0].closest(".fe-item")!;
    expect(row.textContent).toContain(`${stacked.cost} Ko / unité`);
  });

  // « La "flèche hydre" ne peut pas être utilisée avec un arc gratuit » (p.13) : elle ne doit pas
  // être proposée du tout sur l'Arc court, le seul arc gratuit du catalogue.
  describe("munitions interdites sur une arme gratuite", () => {
    const hydre = catalog.munitionKinds!.find((k) => k.id === "fleches")!.types.find((t) => t.label === "Hydre")!;

    /** Déplie le bloc « Munitions » de l'arme portée et rend son contenu. */
    function openMunitions(profileId: string, faction: string) {
      const { container } = render(<EquipPanel {...baseProps(profileId, faction)} />);
      const head = [...container.querySelectorAll(".fe-mun-head")][0] as HTMLButtonElement;
      fireEvent.click(head);
      return head.closest(".fe-mun-block") as HTMLElement;
    }

    it("l'Arc court gratuit ne propose pas la Flèche hydre, mais garde les autres types", () => {
      // L'Éclaireur Mongo I porte l'Arc court (0 Ko) en équipement de base.
      const block = openMunitions("gouns-eclaireur-mongo-1", "gouns");
      expect(within(block).queryByText(hydre.label)).toBeNull();
      expect(within(block).getByText("Perce-armure")).toBeTruthy();
    });

    it("un arc payant la propose toujours", () => {
      // Les Archers khârns portent un arc payant en équipement de base.
      const porteur = catalog.profiles.find((p) =>
        p.baseEquipmentIds.some((id) => {
          const e = catalog.equipment.find((x) => x.id === id);
          return e?.munitionKind === "fleches" && e.cost > 0;
        }),
      )!;
      const block = openMunitions(porteur.id, porteur.factionId ?? "kharns");
      expect(within(block).getByText(hydre.label)).toBeTruthy();
    });
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
