// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { catalog } from "@data";
import { RosterSidebar, type RosterMountEntry } from "./RosterSidebar";
import type { ModelEntry } from "./shared";

afterEach(cleanup);

const modelOf = (profileId: string): ModelEntry => {
  const p = catalog.profiles.find((x) => x.id === profileId)!;
  return { id: p.modelId ?? p.id, name: p.name, profiles: [p] };
};

function props(over: Partial<React.ComponentProps<typeof RosterSidebar>> = {}) {
  const one = modelOf(catalog.profiles[0].id);
  return {
    query: "",
    onQueryChange: vi.fn(),
    factionName: "Fangs",
    models: [one],
    personnages: [one],
    troupes: [] as ModelEntry[],
    conditionnels: [] as ModelEntry[],
    horsFaction: [] as ModelEntry[],
    freresDArmes: [] as ModelEntry[],
    mountTypes: [] as RosterMountEntry[],
    modelMaxed: () => false,
    onQuickAdd: vi.fn(),
    onPreview: vi.fn(),
    onMountPreview: vi.fn(),
    ...over,
  };
}

describe("RosterSidebar (vue)", () => {
  it("affiche les sections non vides", () => {
    render(<RosterSidebar {...props()} />);
    expect(screen.getByText("Personnages")).toBeTruthy();
    // Les sections vides ne sont pas rendues (RosterGroup renvoie null).
    expect(screen.queryByText("Troupes")).toBeNull();
  });

  it("affiche le message de recherche infructueuse quand aucun modèle", () => {
    render(<RosterSidebar {...props({ models: [], query: "zzz" })} />);
    expect(screen.getByText(/Aucun profil ne correspond/i)).toBeTruthy();
  });

  it("affiche le message d'attente de faction quand vide sans recherche", () => {
    render(<RosterSidebar {...props({ models: [], query: "" })} />);
    expect(screen.getByText(/Aucune figurine à recruter pour Fangs/i)).toBeTruthy();
  });

  it("liste les montures et remonte le clic d'aperçu", () => {
    const type = catalog.mountTypes[0];
    const onMountPreview = vi.fn();
    render(
      <RosterSidebar
        {...props({ mountTypes: [{ type, minCost: 12, icon: undefined }], onMountPreview })}
      />,
    );
    expect(screen.getByText("Montures")).toBeTruthy();
    fireEvent.click(screen.getByText(type.name));
    expect(onMountPreview).toHaveBeenCalledWith(type.id);
  });

  it("efface la recherche via la croix", () => {
    const onQueryChange = vi.fn();
    render(<RosterSidebar {...props({ query: "guer", onQueryChange })} />);
    fireEvent.click(screen.getByTitle("Effacer"));
    expect(onQueryChange).toHaveBeenCalledWith("");
  });
});
