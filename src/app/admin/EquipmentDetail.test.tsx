// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { catalog } from "@data";
import { EquipmentDetail } from "./EquipmentDetail";

afterEach(cleanup);

/**
 * Le détail est monté seul, avec un seul objet : passer par `AdminCatalog` faisait rendre les 131
 * lignes de la liste pour vérifier deux libellés, au point de dépasser le délai des tests.
 */
const render1 = (id: string) => {
  const equipment = catalog.equipment.find((e) => e.id === id)!;
  render(<EquipmentDetail equipment={equipment} cat={catalog} onChange={() => {}} onRemove={() => {}} onRenameId={() => {}} />);
  return equipment;
};

describe("EquipmentDetail", () => {
  it("rend les sections communes à tout équipement", () => {
    render1("couteau");
    expect(screen.getByRole("heading", { name: /Texte verbatim/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Réservé à/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Effets/i })).toBeTruthy();
  });

  it("affiche les champs propres au corps à corps", () => {
    render1("couteau");
    expect(screen.getByRole("heading", { name: /Corps à corps/i })).toBeTruthy();
  });

  it("affiche les champs propres à une armure", () => {
    render1("brigandine");
    expect(screen.getByRole("heading", { name: /Armure/i })).toBeTruthy();
  });
});
