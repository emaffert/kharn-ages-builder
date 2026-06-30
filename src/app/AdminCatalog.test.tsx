// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
});
