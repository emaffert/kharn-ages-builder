// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Selector } from "@core";
import { catalog } from "@data";
import { SelectorEditor } from "./SelectorEditor";

afterEach(cleanup);

function Harness({ onChange, allowSelf }: { onChange: (s: Selector) => void; allowSelf?: boolean }) {
  const [sel, setSel] = useState<Selector>({});
  return (
    <SelectorEditor
      selector={sel}
      cat={catalog}
      allowSelf={allowSelf}
      onChange={(s) => {
        setSel(s);
        onChange(s);
      }}
    />
  );
}

describe("SelectorEditor (vue)", () => {
  it("coche « lui-même (self) » et nettoie le sélecteur", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/lui-même/i));
    expect(onChange).toHaveBeenCalledWith({ self: true });
  });

  it("masque la case self quand allowSelf est faux", () => {
    render(<Harness onChange={() => {}} allowSelf={false} />);
    expect(screen.queryByLabelText(/lui-même/i)).toBeNull();
    // Le cavalier et « toutes les figurines » restent proposés.
    expect(screen.getByLabelText(/le cavalier/i)).toBeTruthy();
  });

  it("règle le meneur via le menu déroulant", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "yes" } });
    expect(onChange).toHaveBeenCalledWith({ isLeader: true });
  });
});
