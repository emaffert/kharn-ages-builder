// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { catalog } from "@data";
import type { ListStore } from "../useListStore";
import { FactionSelect } from "./FactionSelect";
import { FACTIONS } from "./shared";

afterEach(cleanup);

/**
 * Tests de vue de l'écran d'accueil (choix de faction / format / budget). `FactionSelect` ne lit du
 * store que `catalog`, `savedLists` et `removeSaved` : un store partiel typé suffit, inutile de monter
 * tout `useListStore`.
 */
function makeStore(over: Partial<ListStore> = {}): ListStore {
  return { catalog, savedLists: [], removeSaved: vi.fn(), ...over } as unknown as ListStore;
}

describe("FactionSelect (vue)", () => {
  it("liste les factions jouables (celles qui ont des profils dans le catalogue)", () => {
    render(<FactionSelect store={makeStore()} onStart={() => {}} onLoad={() => {}} />);
    const withProfiles = FACTIONS.filter((f) => catalog.profiles.some((p) => p.factionId === f.id));
    expect(withProfiles.length).toBeGreaterThan(0);
    for (const f of withProfiles) {
      expect(screen.getByRole("heading", { name: f.name })).toBeTruthy();
    }
  });

  it("désactive les factions « à venir » (sans profil) et les marque comme telles", () => {
    render(<FactionSelect store={makeStore()} onStart={() => {}} onLoad={() => {}} />);
    const soon = FACTIONS.filter((f) => !catalog.profiles.some((p) => p.factionId === f.id));
    for (const f of soon) {
      const tile = screen.getByRole("heading", { name: f.name }).closest("button");
      expect(tile, `tuile ${f.id}`).toBeTruthy();
      expect((tile as HTMLButtonElement).disabled).toBe(true);
    }
    if (soon.length > 0) expect(screen.getAllByText(/à venir/i).length).toBe(soon.length);
  });

  it("démarre une liste avec la faction, le format et le budget sélectionnés", () => {
    const onStart = vi.fn();
    render(<FactionSelect store={makeStore()} onStart={onStart} onLoad={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle liste" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const [factionId, format, points] = onStart.mock.calls[0];
    expect(catalog.profiles.some((p) => p.factionId === factionId)).toBe(true);
    expect(format).toBe("escarmouche");
    expect(points).toBe(300);
  });

  it("affiche « Aucune liste sauvegardée » quand la bibliothèque est vide", () => {
    render(<FactionSelect store={makeStore({ savedLists: [] })} onStart={() => {}} onLoad={() => {}} />);
    expect(screen.getByText(/Aucune liste sauvegardée/i)).toBeTruthy();
  });

  it("liste les listes sauvegardées et charge au clic", () => {
    const doc = {
      id: "l1",
      name: "Ma horde",
      format: "escarmouche",
      updatedAt: new Date().toISOString(),
      fersDeLance: [{ factionId: FACTIONS[0].id, members: [] }],
      snapshot: { totalCost: 250, entries: [] },
    };
    const onLoad = vi.fn();
    render(
      <FactionSelect
        store={makeStore({ savedLists: [doc as unknown as ListStore["savedLists"][number]] })}
        onStart={() => {}}
        onLoad={onLoad}
      />,
    );
    expect(screen.getByText("Ma horde")).toBeTruthy();
    expect(screen.getByText(/250 Ko/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ma horde"));
    expect(onLoad).toHaveBeenCalledWith(doc);
  });
});
