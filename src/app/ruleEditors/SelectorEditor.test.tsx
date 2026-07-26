// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { EffectSource, Selector } from "@core";
import { catalog } from "@data";
import { SelectorEditor, type SelectorRole } from "./SelectorEditor";

afterEach(cleanup);

function Harness({
  onChange,
  role,
  sourceKind,
  withEquipment,
  initial = {},
}: {
  onChange?: (s: Selector) => void;
  role?: SelectorRole;
  sourceKind?: EffectSource["kind"];
  withEquipment?: boolean;
  initial?: Selector;
}) {
  const [sel, setSel] = useState<Selector>(initial);
  return (
    <SelectorEditor
      selector={sel}
      cat={catalog}
      role={role}
      sourceKind={sourceKind}
      withEquipment={withEquipment}
      onChange={(s) => {
        setSel(s);
        onChange?.(s);
      }}
    />
  );
}

describe("SelectorEditor - la position décide des champs", () => {
  it("nomme la source selon ce qui porte l'effet", () => {
    render(<Harness sourceKind="equipment" />);
    expect(screen.getByLabelText(/porte cet équipement/i)).toBeTruthy();
  });

  it("sur une monture, ne propose que le cavalier et écrit « cavalier »", () => {
    const onChange = vi.fn();
    render(<Harness sourceKind="mount" onChange={onChange} />);
    // Pas de doublon « lui-même » : sur une monture les deux désignaient la même figurine.
    expect(screen.queryByLabelText(/cette figurine/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/le cavalier/i));
    expect(onChange).toHaveBeenCalledWith({ cavalier: true });
  });

  it("masque les dimensions d'identité quand la cible est la source elle-même", () => {
    render(<Harness initial={{ self: true }} />);
    expect(screen.queryByText(/^Profils$/)).toBeNull();
  });

  it("ne propose « au moins » que sur une condition", () => {
    const seen = (role: SelectorRole) => {
      cleanup();
      render(<Harness role={role} />);
      return screen.queryByLabelText(/Figurines correspondantes/i) != null;
    };
    expect(seen("condition")).toBe(true);
    expect(seen("target")).toBe(false);
    expect(seen("group")).toBe(false);
    expect(seen("link")).toBe(false);
  });

  it("ne propose « meneur » ni « toutes les figurines » sur une liaison", () => {
    render(<Harness role="link" />);
    expect(screen.queryByLabelText(/Meneur/i)).toBeNull();
    expect(screen.queryByLabelText(/toutes les figurines/i)).toBeNull();
    // L'identité, elle, reste : c'est tout ce que le constructeur sait résoudre.
    expect(screen.getByText(/^Profils$/)).toBeTruthy();
  });

  it("n'ouvre le filtre d'équipement que pour une opération qui sait le lire", () => {
    render(<Harness role="target" withEquipment />);
    expect(screen.getByText(/Sur quel équipement/i)).toBeTruthy();
    cleanup();
    render(<Harness role="target" />);
    expect(screen.queryByText(/Sur quel équipement/i)).toBeNull();
  });
});
