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
    grantedEquipment: [] as string[],
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

  // Ombre-Glace, comprise dans les « Atouts de Mathys » : portée sans être achetée, non retirable,
  // et jamais proposée au catalogue d'achat.
  describe("équipement octroyé par une carte", () => {
    const EPEE = "guilde-noire-ombre-glace";
    const epee = () => catalog.equipment.find((e) => e.id === EPEE)!;
    const props = () => ({ ...baseProps("guilde-noire-mathys-3", "guilde-noire"), grantedEquipment: [EPEE] });

    it("apparaît dans « Équipé », marquée offerte et verrouillée", () => {
      const { container } = render(<EquipPanel {...props()} />);
      const equipe = container.querySelectorAll(".fe-panes > div")[0] as HTMLElement;
      const ligne = within(equipe).getByText(epee().name).closest(".fe-item")!;
      expect(ligne.textContent).toContain("offert");
      expect(ligne.textContent).toContain("compris");
      expect(ligne.querySelector(".fe-move.rem")).toBeNull(); // pas de bouton « retirer »
      expect(ligne.querySelector(".fe-move.is-locked")).toBeTruthy();
    });

    it("porte sa case d'Affûtage, comme une arme achetée", () => {
      const p = props();
      render(<EquipPanel {...p} />);
      fireEvent.click(screen.getByRole("button", { name: "Affûtage" }));
      expect(p.onInfo).toHaveBeenCalled();
    });

    it("n'est jamais proposée à l'achat, même sans la carte", () => {
      const { container } = render(<EquipPanel {...baseProps("guilde-noire-mathys-3", "guilde-noire")} />);
      const dispo = container.querySelectorAll(".fe-panes > div")[1] as HTMLElement;
      expect(within(dispo).queryByText(epee().name)).toBeNull();
    });
  });

  // L'amélioration se coche pour l'acheter, et son nom s'ouvre pour savoir ce qu'elle fait.
  describe("améliorations sous l'arme", () => {
    /** Une Goulue avec l'Épée, arme tranchante payante : l'Affûtage lui est proposé. */
    const props = () => ({ ...baseProps("fangs-goulue-1"), added: ["epee"] });

    it("le nom de l'amélioration ouvre sa fiche, sans la cocher", () => {
      const p = props();
      render(<EquipPanel {...p} />);
      const affutage = screen.getByRole("button", { name: "Affûtage" });
      fireEvent.click(affutage);
      expect(p.onInfo).toHaveBeenCalledTimes(1);
      expect(p.onToggleEquipmentUpgrade).not.toHaveBeenCalled();
      const info = p.onInfo.mock.calls[0][0];
      expect(info.title).toBe("Affûtage");
      expect(info.text).toContain("dégât");
      expect(info.price).toBe("+8 Ko");
    });

    it("la case, elle, achète l'amélioration", () => {
      const p = props();
      const { container } = render(<EquipPanel {...p} />);
      fireEvent.click(container.querySelector(".fe-upgrade input[type=checkbox]")!);
      expect(p.onToggleEquipmentUpgrade).toHaveBeenCalledWith("epee", "affutage");
    });
  });

  // « Ne peut manier d'arme de tir ou à 2 mains » (Key le Sénéchal) : l'interdiction porte sur les
  // armes à deux mains, pas sur toute la catégorie. Le panneau lui retirait ses armes de mêlée.
  describe("interdiction limitée au nombre de mains", () => {
    /** Noms des armes proposées à l'achat dans le volet « Disponible ». */
    function weaponsOffered(profileId: string, faction: string) {
      const { container } = render(<EquipPanel {...baseProps(profileId, faction)} />);
      const avail = container.querySelectorAll(".fe-panes > div")[1] as HTMLElement;
      return catalog.equipment
        .filter((e) => e.category === "arme-cac" || e.category === "arme-tir")
        .filter((e) => within(avail).queryAllByText(e.name).length > 0);
    }

    it("Key garde ses armes de corps à corps à une main", () => {
      const armes = weaponsOffered("kharns-key", "kharns");
      expect(armes.length).toBeGreaterThan(0);
      expect(armes.every((e) => e.category === "arme-cac")).toBe(true); // le tir lui reste fermé
      expect(armes.every((e) => e.hands !== 2)).toBe(true); // les deux mains aussi
      expect(armes.some((e) => e.hands === 1)).toBe(true);
    });

    it("une interdiction de catégorie entière ferme bien la catégorie (Larbin : aucune arme)", () => {
      expect(weaponsOffered("fangs-larbin-1", "fangs")).toHaveLength(0);
    });
  });

  // Casques (p.14) : portés « en complément d'une armure ou non », donc sur leur propre emplacement,
  // mais un seul par Safar.
  describe("emplacement de casque", () => {
    const casque = catalog.equipment.find((e) => e.category === "casque")!;
    const autreCasque = catalog.equipment.find((e) => e.category === "casque" && e.id !== casque.id)!;

    /** Bouton d'ajout d'un équipement dans le volet « Disponible ». */
    function addButton(props: ReturnType<typeof baseProps>, equipName: string) {
      const { container } = render(<EquipPanel {...props} />);
      const avail = container.querySelectorAll(".fe-panes > div")[1] as HTMLElement;
      const label = within(avail).getAllByText(equipName)[0];
      return label.closest(".fe-item")!.querySelector(".fe-move.add") as HTMLButtonElement;
    }

    it("affiche le compteur de casque et laisse acheter le premier", () => {
      const props = baseProps("fangs-goulue-1");
      expect(addButton(props, casque.name).disabled).toBe(false);
      const { container } = render(<EquipPanel {...props} />);
      const slots = [...container.querySelectorAll(".fe-slot")].map((s) => s.textContent);
      expect(slots.some((t) => t?.startsWith("Casque") && t.includes("0/1"))).toBe(true);
    });

    it("ferme l'achat d'un second casque", () => {
      const props = { ...baseProps("fangs-goulue-1"), added: [casque.id] };
      expect(addButton(props, autreCasque.name).disabled).toBe(true);
    });

    it("n'occupe pas l'emplacement d'armure", () => {
      const armure = catalog.equipment.find((e) => e.category === "armure" && e.reservedTo == null)!;
      const props = { ...baseProps("fangs-goulue-1"), added: [casque.id] };
      expect(addButton(props, armure.name).disabled).toBe(false);
    });
  });

  // « Chaque Safar peut partir au combat avec une et unique arme gratuite » (FAQ 2026), celle de sa
  // carte comprise : les autres restent affichées, mais leur achat est fermé.
  describe("une seule arme gratuite par Safar", () => {
    /** Boutons d'ajout des armes gratuites du volet « Disponible », dans l'ordre du catalogue. */
    function freeWeaponButtons(props: ReturnType<typeof baseProps>) {
      const { container } = render(<EquipPanel {...props} />);
      const avail = container.querySelectorAll(".fe-panes > div")[1] as HTMLElement;
      return catalog.equipment
        .filter((e) => e.cost === 0 && ["arme-cac", "arme-tir"].includes(e.category))
        .flatMap((e) => within(avail).queryAllByText(e.name))
        .map((label) => label.closest(".fe-item")!.querySelector(".fe-move.add") as HTMLButtonElement);
    }

    it("les armes gratuites restent visibles mais inachetables à qui porte celle de sa carte", () => {
      // L'Éclaireur Mongo I porte l'Arc court (0 Ko) en équipement de base.
      const boutons = freeWeaponButtons(baseProps("gouns-eclaireur-mongo-1", "gouns"));
      expect(boutons.length).toBeGreaterThan(0);
      expect(boutons.every((b) => b.disabled)).toBe(true);
      expect(screen.getByText(/Une seule arme gratuite par Safar/i)).toBeTruthy();
    });

    it("elles redeviennent achetables dès que celle de la carte est rendue", () => {
      const props = { ...baseProps("gouns-eclaireur-mongo-1", "gouns"), removed: ["arc-court"] };
      const boutons = freeWeaponButtons(props);
      expect(boutons.length).toBeGreaterThan(0);
      expect(boutons.some((b) => b.disabled)).toBe(false);
    });

    it("une arme gratuite achetée ferme l'achat des autres", () => {
      // Une Affamée : sa carte ne porte aucune arme gratuite, et rien ne lui interdit les armes.
      const libre = freeWeaponButtons(baseProps("fangs-affame-1"));
      expect(libre.length).toBeGreaterThan(0);
      expect(libre.some((b) => b.disabled)).toBe(false);

      const armee = freeWeaponButtons({ ...baseProps("fangs-affame-1"), added: ["gourdin"] });
      expect(armee.length).toBeGreaterThan(0);
      expect(armee.every((b) => b.disabled)).toBe(true);
    });
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
