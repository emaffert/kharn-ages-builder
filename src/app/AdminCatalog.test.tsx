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
    fireEvent.click(screen.getByRole("button", { name: "Équipement" }));
    expect(screen.getByText(/Texte verbatim/i)).toBeTruthy();
    expect(screen.getByText(/\+ équipement/i)).toBeTruthy();
  });

  it("ouvre les onglets Cartes spéciales et Sorts", () => {
    render(<AdminCatalog />);
    fireEvent.click(screen.getByRole("button", { name: "Cartes spé." }));
    expect(screen.getByText(/\+ carte spéciale/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sorts" }));
    expect(screen.getByText(/Difficultés/i)).toBeTruthy();
    expect(screen.getByText(/\+ sort/i)).toBeTruthy();
  });
});
