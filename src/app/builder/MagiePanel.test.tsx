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
    onInfo: vi.fn(),
    ...over,
  };
}

describe("MagiePanel (vue)", () => {
  it("propose les trois paliers de grimoire et le compteur de pages", () => {
    render(<MagiePanel {...baseProps()} />);
    expect(screen.getByText("Sans grimoire")).toBeTruthy();
    expect(screen.getByText(/Petit \+/)).toBeTruthy();
    expect(screen.getByText(/Grand \+/)).toBeTruthy();
    expect(screen.getByText("Pages")).toBeTruthy();
  });

  it("remonte le choix de grimoire via onGrimoire", () => {
    const onGrimoire = vi.fn();
    render(<MagiePanel {...baseProps({ onGrimoire })} />);
    fireEvent.click(screen.getByText(/Petit \+/));
    expect(onGrimoire).toHaveBeenCalledWith("petit");
  });

  it("avertit quand la figurine ne peut pas lancer mais a des sorts sélectionnés", () => {
    const spell = catalog.spells[0];
    render(<MagiePanel {...baseProps({ ways: [], spells: [spell.id] })} />);
    expect(screen.getByText(/ne peut pas lancer de sorts/i)).toBeTruthy();
  });
});
