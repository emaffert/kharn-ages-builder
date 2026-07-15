// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AdminCatalog } from "./AdminCatalog";

afterEach(cleanup);

describe("AdminCatalog (rendu)", () => {
  it("rend sans erreur et liste des profils", () => {
    render(<AdminCatalog />);
    expect(screen.getAllByText(/Larbin/i).length).toBeGreaterThan(0);
  });

  it("affiche les sections de revue (contraintes, effets, règles)", () => {
    render(<AdminCatalog />);
    expect(screen.getAllByText(/Contraintes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Effets/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/verbatim/i).length).toBeGreaterThan(0);
  });

  it("affiche les éditeurs de contraintes et d'effets (boutons d'ajout)", () => {
    render(<AdminCatalog />);
    expect(screen.getByText(/\+ contrainte/i)).toBeTruthy();
    expect(screen.getByText(/\+ effet/i)).toBeTruthy();
  });

  it("bascule sur l'onglet Équipement et permet d'éditer un équipement", () => {
    render(<AdminCatalog />);
    // Nav à deux niveaux : sélectionner la grande partie avant sa sous-partie.
    fireEvent.click(screen.getByRole("button", { name: "Objets" }));
    fireEvent.click(screen.getByRole("button", { name: "Équipement" }));
    // Titre de section (h3) : le sommaire ancré liste aussi ce libellé, d'où le ciblage par rôle.
    expect(screen.getByRole("heading", { name: /Texte verbatim/i })).toBeTruthy();
    expect(screen.getByText(/\+ équipement/i)).toBeTruthy();
  });

  it("ouvre les onglets Cartes spéciales et Sorts", () => {
    render(<AdminCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "Cartes spé." }));
    expect(screen.getByText(/\+ carte spéciale/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Magie" }));
    fireEvent.click(screen.getByRole("button", { name: "Sorts" }));
    expect(screen.getByRole("heading", { name: /Difficultés/i })).toBeTruthy();
    expect(screen.getByText(/\+ sort/i)).toBeTruthy();
  });

  it("ouvre l'onglet Voies de magie", () => {
    render(<AdminCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "Magie" }));
    fireEvent.click(screen.getByRole("button", { name: "Voies" }));
    expect(screen.getByRole("heading", { name: /Voies de magie/i })).toBeTruthy();
  });

  // La grande partie de nav et sa première sous-partie partagent le même libellé (« Montures »,
  // « Réglages ») ; après ouverture du groupe, les deux boutons coexistent → on clique le dernier
  // (la sous-partie, rendue après le bouton de groupe) pour changer réellement de vue.
  const clickSubtab = (name: string) => {
    const btns = screen.getAllByRole("button", { name });
    fireEvent.click(btns[btns.length - 1]);
  };

  it("ouvre les onglets Montures et Options de monture", () => {
    render(<AdminCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "Montures" }));
    clickSubtab("Montures");
    expect(screen.getByRole("heading", { name: /Type/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("heading", { name: /Compétence conférée/i })).toBeTruthy();
  });

  it("ouvre l'onglet Réglages (factions, grimoires, surcoût Tembo)", () => {
    render(<AdminCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    clickSubtab("Réglages");
    expect(screen.getByRole("heading", { name: /Grimoires/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Surcoût Tembo/i })).toBeTruthy();
  });
});
