// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { catalog } from "@data";
import { MagiePanel } from "./MagiePanel";

afterEach(cleanup);

function baseProps(over: Partial<React.ComponentProps<typeof MagiePanel>> = {}) {
  const p = catalog.profiles[0];
  const way = catalog.magicWays[0];
  return {
    profile: p,
    cat: catalog,
    upgrades: [] as string[],
    grimoire: "none" as const,
    spells: [] as string[],
    ways: [way.id],
    wornEquipIds: [] as string[],
    onGrimoire: vi.fn(),
    onToggleSpell: vi.fn(),
    onToggleGrantedSpell: vi.fn(),
    onInfo: vi.fn(),
    ...over,
  };
}

/** Bascule vers le budget de pages (l'onglet s'ouvre sur les génériques quand il n'y a pas de grimoire). */
const openGrimoire = () => fireEvent.click(screen.getByText(/^Grimoire /));

describe("MagiePanel (vue)", () => {
  it("propose les trois paliers de grimoire et le compteur de pages", () => {
    render(<MagiePanel {...baseProps()} />);
    openGrimoire();
    expect(screen.getByText("Sans grimoire")).toBeTruthy();
    expect(screen.getByText(/Petit \+/)).toBeTruthy();
    expect(screen.getByText(/Grand \+/)).toBeTruthy();
    expect(screen.getByText("Pages")).toBeTruthy();
  });

  it("remonte le choix de grimoire via onGrimoire", () => {
    const onGrimoire = vi.fn();
    render(<MagiePanel {...baseProps({ onGrimoire })} />);
    openGrimoire();
    fireEvent.click(screen.getByText(/Petit \+/));
    expect(onGrimoire).toHaveBeenCalledWith("petit");
  });

  it("avertit quand la figurine ne peut pas lancer mais a des sorts sélectionnés", () => {
    const spell = catalog.spells[0];
    render(<MagiePanel {...baseProps({ ways: [], spells: [spell.id] })} />);
    expect(screen.getByText(/ne peut pas lancer de sorts/i)).toBeTruthy();
  });
});

describe("MagiePanel - séparation des deux budgets", () => {
  const bharbathos = catalog.profiles.find((p) => p.id === "guilde-noire-bharbathos-3")!;
  const mage = (over: Partial<React.ComponentProps<typeof MagiePanel>> = {}) =>
    baseProps({ profile: bharbathos, ways: ["osteomancie"], ...over });

  it("ouvre sur les génériques quand la figurine n'a ni grimoire ni sort de voie", () => {
    render(<MagiePanel {...mage()} />);
    // Le palier de grimoire vit sous l'autre onglet : il n'est pas rendu ici.
    expect(screen.queryByText("Sans grimoire")).toBeNull();
    expect(screen.getByText("Niveaux")).toBeTruthy();
  });

  it("ouvre sur le grimoire quand la figurine en a déjà un", () => {
    render(<MagiePanel {...mage({ grimoire: "petit" })} />);
    expect(screen.getByText("Sans grimoire")).toBeTruthy();
    expect(screen.queryByText("Niveaux")).toBeNull();
  });

  it("chaque segment porte son solde, l'autre budget reste lisible sans y basculer", () => {
    render(<MagiePanel {...mage({ spells: ["guilde-noire-passe-passe"] })} />);
    // Passe-Passe vaut 3 niveaux et n'entame pas les pages.
    expect(screen.getByText("Sorts génériques 3/3 niv")).toBeTruthy();
    expect(screen.getByText("Grimoire 0/0 p")).toBeTruthy();
  });

  it("un générique hors budget est proposé mais bloqué", () => {
    render(<MagiePanel {...mage({ spells: ["guilde-noire-passe-passe"] })} />);
    const add = screen.getAllByTitle("Budget de niveaux insuffisant");
    expect(add.length).toBeGreaterThan(0);
  });

  it("ne mélange pas les deux familles dans un même volet", () => {
    render(<MagiePanel {...mage({ grimoire: "petit" })} />);
    // Onglet grimoire : les génériques du catalogue n'y figurent pas.
    expect(screen.queryByText("Confusion")).toBeNull();
    fireEvent.click(screen.getByText(/^Sorts génériques /));
    expect(screen.getByText("Confusion")).toBeTruthy();
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

describe("MagiePanel - sorts offerts", () => {
  const GRANT = grantEffectId();
  const ORDRE_SEPULCRAL = "spell-1785239128129";
  const demiSoeur = catalog.profiles.find((p) => p.id === "profile-1785410170666")!;
  const offerte = (over: Partial<React.ComponentProps<typeof MagiePanel>> = {}) =>
    baseProps({ profile: demiSoeur, ways: ["osteomancie"], ...over });

  const openOfferts = () => fireEvent.click(screen.getByText(/^Sorts offerts /));

  it("un troisième segment apparaît, avec son propre compteur", () => {
    render(<MagiePanel {...offerte()} />);
    expect(screen.getByText("Sorts offerts 0/1")).toBeTruthy();
  });

  it("le segment n'existe pas pour une figurine sans offre", () => {
    const goulue = catalog.profiles.find((p) => p.id === "fangs-goulue-1")!;
    render(<MagiePanel {...baseProps({ profile: goulue, ways: ["osteomancie"] })} />);
    expect(screen.queryByText(/^Sorts offerts /)).toBeNull();
  });

  it("le choix remonte avec l'identifiant de l'offre", () => {
    const onToggleGrantedSpell = vi.fn();
    render(<MagiePanel {...offerte({ onToggleGrantedSpell })} />);
    openOfferts();
    const row = screen.getByText("Ordre sépulcral").closest(".fe-item")!;
    fireEvent.click(row.querySelector("button.add")!);
    expect(onToggleGrantedSpell).toHaveBeenCalledWith(GRANT, ORDRE_SEPULCRAL);
  });

  it("l'offre servie bloque les ajouts suivants", () => {
    render(<MagiePanel {...offerte({ grantedSpells: { [GRANT]: [ORDRE_SEPULCRAL] } })} />);
    expect(screen.getByText("Sorts offerts 1/1")).toBeTruthy();
    openOfferts();
    expect(screen.getAllByTitle("Déjà 1 sort choisi").length).toBeGreaterThan(0);
  });

  it("un sort pris en offert n'est plus proposé à l'achat", () => {
    render(<MagiePanel {...offerte({ grimoire: "grand", grantedSpells: { [GRANT]: [ORDRE_SEPULCRAL] } })} />);
    // Volet grimoire : le sort est connu, il n'a plus à être payé.
    expect(screen.queryByText("Ordre sépulcral")).toBeNull();
  });

  it("un choix dont l'offre a disparu est signalé", () => {
    render(<MagiePanel {...offerte({ grantedSpells: { "effet-envole": [ORDRE_SEPULCRAL] } })} />);
    expect(screen.getByText(/sort offert sans source/i)).toBeTruthy();
  });
});
