// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { EffectOperation } from "@core";
import { catalog } from "@data";
import { OperationEditor } from "./OperationEditor";

afterEach(cleanup);

/** Wrapper contrôlé : le menu d'action remplace `op` par l'opération par défaut du type choisi. */
function Harness() {
  const [op, setOp] = useState<EffectOperation>({ kind: "cost-delta", amount: 0 });
  return <OperationEditor op={op} cat={catalog} onChange={setOp} />;
}

// Chaque type d'action affiche des champs spécifiques : un marqueur par branche (texte, ou
// placeholder pour les champs sans libellé unique comme stat-modifier).
const KIND_MARKERS: [EffectOperation["kind"], { text?: RegExp; placeholder?: RegExp }][] = [
  ["cost-delta", { text: /si arme de base changée/i }],
  ["cost-set", { text: /Plafond de cibles/i }],
  ["grimoire-discount", { text: /Grimoire concerné/i }],
  ["unlock-upgrade", { text: /Catégories d'équipement/i }],
  ["grant-skill", { text: /\+ si déjà connue/i }],
  ["grant-spell", { text: /^Sort$/ }],
  ["grant-trait", { text: /tag interne/i }],
  ["grant-mastery-die", { text: /Domaines du dé/i }],
  ["stat-modifier", { placeholder: /nb ou/i }],
  ["stat-count", { text: /nombre de figurines/i }],
  ["stat-max", { text: /la plus forte/i }],
  ["skill-count", { text: /Par groupe de/i }],
  ["spell-pages", { text: /Voie dédiée/i }],
  ["limit-modifier", { text: /Montant/i }],
];

describe("OperationEditor (vue)", () => {
  it("affiche les champs propres à chaque type d'action", () => {
    const { container } = render(<Harness />);
    const actionSelect = container.querySelector("select")!; // le premier select est « Action »
    for (const [kind, marker] of KIND_MARKERS) {
      fireEvent.change(actionSelect, { target: { value: kind } });
      const found = marker.placeholder
        ? screen.getByPlaceholderText(marker.placeholder)
        : screen.getByText(marker.text!);
      expect(found, `champ manquant pour ${kind}`).toBeTruthy();
    }
  });

  it("propose toutes les actions du menu (une option par type)", () => {
    const { container } = render(<Harness />);
    const actionSelect = container.querySelector("select")!;
    const values = [...actionSelect.querySelectorAll("option")].map((o) => (o as HTMLOptionElement).value);
    for (const [kind] of KIND_MARKERS) expect(values).toContain(kind);
  });

  it("édite la valeur d'un cost-delta via le callback onChange", () => {
    const onChange = vi.fn();
    render(<OperationEditor op={{ kind: "cost-delta", amount: 0 }} cat={catalog} onChange={onChange} />);
    const num = screen.getByRole("spinbutton");
    fireEvent.change(num, { target: { value: "-15" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "cost-delta", amount: -15 });
  });
});
