// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Constraint } from "@core";
import { catalog } from "@data";
import { ConstraintListEditor } from "./RuleEditors";

afterEach(cleanup);

/** Contrainte de rattachement telle qu'elle existe en base (Likan → femelle Fang). */
const attachment = (): Constraint => ({
  id: "c-test",
  type: "attachment",
  params: { carrier: { label: "une femelle Fang", trait: "femelle-fang" } },
  scope: "fer-de-lance",
  sourceText: "",
});

function Harness({ initial, onChange }: { initial: Constraint; onChange: (c: Constraint) => void }) {
  const [list, setList] = useState<Constraint[]>([initial]);
  return (
    <ConstraintListEditor
      constraints={list}
      cat={catalog}
      onChange={(c) => {
        setList(c);
        onChange(c[0]);
      }}
    />
  );
}

/** Déplie la carte de règle (les champs sont dans un `<details>` replié). */
function open() {
  const summary = document.querySelector("summary");
  if (summary) fireEvent.click(summary);
}

const carrierOf = (c: Constraint) => c.params.carrier as Record<string, unknown> | undefined;

describe("ConstraintListEditor - rattachement", () => {
  it("conserve le nom lisible du porteur quand on édite son trait", () => {
    let last = attachment();
    render(<Harness initial={last} onChange={(c) => (last = c)} />);
    open();
    fireEvent.change(screen.getByLabelText(/Trait du porteur/i), { target: { value: "femelle-fang-2" } });
    expect(carrierOf(last)).toEqual({ label: "une femelle Fang", trait: "femelle-fang-2" });
  });

  it("conserve le trait quand on édite le nom lisible", () => {
    let last = attachment();
    render(<Harness initial={last} onChange={(c) => (last = c)} />);
    open();
    fireEvent.change(screen.getByLabelText(/Nom lisible du porteur/i), { target: { value: "une Fang" } });
    expect(carrierOf(last)).toEqual({ label: "une Fang", trait: "femelle-fang" });
  });

  it("avertit quand plus aucune dimension de porteur n'est renseignée", () => {
    let last = attachment();
    render(<Harness initial={last} onChange={(c) => (last = c)} />);
    open();
    fireEvent.change(screen.getByLabelText(/Trait du porteur/i), { target: { value: "" } });
    expect(screen.getByText(/redevient recrutable directement/i)).toBeTruthy();
    expect(carrierOf(last)).toEqual({ label: "une femelle Fang" });
  });

  it("n'expose qu'une manière de désigner le porteur à la fois", () => {
    render(<Harness initial={attachment()} onChange={() => {}} />);
    open();
    expect(screen.getByLabelText(/Trait du porteur/i)).toBeTruthy();
    expect(screen.queryByText(/Profils porteurs/i)).toBeNull();
    expect(screen.queryByText(/Modèles porteurs/i)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Des profils/i }));
    expect(screen.queryByLabelText(/Trait du porteur/i)).toBeNull();
    expect(screen.getByText(/Profils porteurs/i)).toBeTruthy();
  });

  it("abandonne le trait en changeant de manière, mais garde le nom lisible", () => {
    let last = attachment();
    render(<Harness initial={last} onChange={(c) => (last = c)} />);
    open();
    fireEvent.click(screen.getByRole("radio", { name: /Des modèles/i }));
    expect(carrierOf(last)).toEqual({ label: "une femelle Fang" });
  });
});

describe("ConstraintListEditor - portée", () => {
  it("énonce la portée sans la proposer au choix quand le type l'impose", () => {
    render(<Harness initial={attachment()} onChange={() => {}} />);
    open();
    expect(screen.queryByLabelText(/Où chercher/i)).toBeNull();
    expect(screen.getByText(/même Fer de Lance/i)).toBeTruthy();
  });

  it("propose Fer de Lance ou Ost sur « nécessite une présence »", () => {
    let last = attachment();
    render(<Harness initial={last} onChange={(c) => (last = c)} />);
    open();
    fireEvent.change(screen.getByLabelText(/^Type/i), { target: { value: "requires-present" } });
    // Le changement de type repose des params vierges et la portée par défaut du nouveau type.
    expect(last.params).toEqual({});
    expect(last.scope).toBe("fer-de-lance");

    fireEvent.change(screen.getByLabelText(/Où chercher/i), { target: { value: "ost" } });
    expect(last.scope).toBe("ost");
  });
});
