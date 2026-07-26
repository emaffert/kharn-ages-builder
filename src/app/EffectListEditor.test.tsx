// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Effect } from "@core";
import { catalog } from "@data";
import { EffectListEditor } from "./RuleEditors";

afterEach(cleanup);

const SOURCE: Effect["source"] = { kind: "profile", id: "gouns-alaric-1" };

/** Effet d'Alaric : « Connaît le sort Lien Mental d'office » - ne vise que lui-même. */
const alaric = (over: Partial<Effect> = {}): Effect => ({
  id: "grant-spell-lien-mental",
  source: SOURCE,
  scope: "fer-de-lance",
  target: { self: true },
  operation: { kind: "grant-spell", spellId: "lien-mental" },
  sourceText: "Connaît le sort « Lien Mental » d'office.",
  ...over,
});

/** Même effet, mais avec une action que le moteur résout dans son pipeline. */
const enginePowered = (over: Partial<Effect> = {}): Effect =>
  alaric({ operation: { kind: "grant-skill", skillId: "riposte" }, ...over });

function Harness({ initial, onChange }: { initial: Effect; onChange?: (e: Effect) => void }) {
  const [list, setList] = useState<Effect[]>([initial]);
  return (
    <EffectListEditor
      effects={list}
      newSource={SOURCE}
      cat={catalog}
      onChange={(e) => {
        setList(e);
        onChange?.(e[0]);
      }}
    />
  );
}

/** Déplie la carte d'effet (les réglages sont dans un `<details>` replié). */
function open() {
  fireEvent.click(document.querySelector("summary")!);
}

describe("EffectListEditor - la portée n'est demandée que si elle change quelque chose", () => {
  /** Le menu de portée lui-même : « portée » apparaît aussi dans le libellé d'une case du sélecteur. */
  const scopeSelect = () => screen.queryByRole("combobox", { name: /Périmètre/i });

  it("ne la demande pas quand l'effet ne vise que sa source", () => {
    render(<Harness initial={enginePowered()} />);
    open();
    expect(scopeSelect()).toBeNull();
  });

  it("la demande dès que l'effet vise d'autres figurines", () => {
    render(<Harness initial={enginePowered({ target: { traits: ["goun"] } })} />);
    open();
    expect(scopeSelect()).toBeTruthy();
  });

  it("la demande sur une cible « source » assortie d'une condition", () => {
    // La condition, elle, s'évalue sur un ensemble : la portée dit lequel.
    render(<Harness initial={enginePowered({ condition: { traits: ["goun"], countAtLeast: 3 } })} />);
    open();
    expect(scopeSelect()).toBeTruthy();
  });

  it("la demande sur une opération de comptage, même ciblée sur la source", () => {
    render(<Harness initial={alaric({ operation: { kind: "stat-count", stat: "t", of: { traits: ["dogon"] } } })} />);
    open();
    expect(scopeSelect()).toBeTruthy();
  });

  it("la place sous le choix de cible, pas au-dessus", () => {
    // Les deux répondent à « à qui » : les séparer, ou inverser leur ordre, casse la lecture.
    render(<Harness initial={enginePowered({ target: { traits: ["goun"] } })} />);
    open();
    const mode = screen.getByRole("radiogroup", { name: /Qui est visé/i });
    const scope = scopeSelect()!;
    expect(mode.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("EffectListEditor - la liaison n'apparaît que là où elle joue", () => {
  const linkBlock = () => screen.queryByText(/^Liaison à une autre figurine$/);

  it("reste absente d'une opération qui n'est pas une opération de coût", () => {
    render(<Harness initial={alaric()} />);
    open();
    expect(linkBlock()).toBeNull();
  });

  it("apparaît sur « Fixer le coût », dont le moteur filtre les cibles par la liaison", () => {
    render(<Harness initial={alaric({ operation: { kind: "cost-set", amount: 0 } })} />);
    open();
    expect(linkBlock()).toBeTruthy();
  });

  it("apparaît sur « Modifier le coût » porté par une figurine (cas Djouked)", () => {
    render(<Harness initial={alaric({ operation: { kind: "cost-delta", amount: -35 } })} />);
    open();
    expect(linkBlock()).toBeTruthy();
  });

  it("reste absente d'un « Modifier le coût » porté par une carte, qui n'a pas ce verrou", () => {
    render(
      <Harness
        initial={alaric({
          source: { kind: "special-card", id: "fille-de-nyx" },
          operation: { kind: "cost-delta", amount: -5 },
        })}
      />,
    );
    open();
    expect(linkBlock()).toBeNull();
  });

  it("n'affiche pas une liaison sur une action qui ne la lit pas", () => {
    render(<Harness initial={alaric({ designation: { of: { traits: ["fille-de-nyx"] } } })} />);
    open();
    expect(linkBlock()).toBeNull();
  });
});

describe("EffectListEditor - changer d'action ne laisse pas de réglage mort derrière elle", () => {
  /** Le menu d'action de l'opération (le premier select de la carte dépliée). */
  const chooseAction = (kind: string) =>
    fireEvent.change(screen.getByRole("combobox", { name: /Action/i }), { target: { value: kind } });

  it("emporte le filtre d'équipement quand l'action ne sait plus le lire", () => {
    let last = alaric();
    render(
      <Harness
        initial={alaric({
          operation: { kind: "cost-delta", amount: -10 },
          target: { self: true, equipmentHands: [2] },
        })}
        onChange={(e) => (last = e)}
      />,
    );
    open();
    chooseAction("grant-skill");
    expect(last.target).toEqual({ self: true });
  });

  it("garde le filtre d'équipement tant qu'on reste sur « Modifier le coût »", () => {
    let last = alaric();
    render(
      <Harness
        initial={alaric({
          operation: { kind: "cost-delta", amount: -10 },
          target: { self: true, equipmentHands: [2] },
        })}
        onChange={(e) => (last = e)}
      />,
    );
    open();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "-15" } });
    expect(last.target).toEqual({ self: true, equipmentHands: [2] });
  });

  it("emporte la liaison quand l'action ne la verrouille plus", () => {
    let last = alaric();
    render(
      <Harness
        initial={alaric({
          operation: { kind: "cost-set", amount: 0 },
          designation: { of: { traits: ["fille-de-nyx"] } },
        })}
        onChange={(e) => (last = e)}
      />,
    );
    open();
    chooseAction("grant-skill");
    expect(last.designation).toBeUndefined();
  });

  it("garde la liaison en passant d'une action de coût à l'autre", () => {
    let last = alaric();
    render(
      <Harness
        initial={alaric({
          operation: { kind: "cost-set", amount: 0 },
          designation: { of: { traits: ["fille-de-nyx"] } },
        })}
        onChange={(e) => (last = e)}
      />,
    );
    open();
    chooseAction("cost-delta");
    expect(last.designation).toEqual({ of: { traits: ["fille-de-nyx"] } });
  });

  it("ramène cible et conditions au porteur en passant à une action résolue hors moteur", () => {
    let last = alaric();
    render(
      <Harness
        initial={enginePowered({
          target: { traits: ["goun"] },
          condition: { traits: ["goun"], countAtLeast: 2 },
        })}
        onChange={(e) => (last = e)}
      />,
    );
    open();
    chooseAction("spell-pages");
    expect(last.target).toEqual({ self: true });
    expect(last.condition).toBeUndefined();
  });
});

describe("EffectListEditor - « Modifier la limitation » vise des groupes, pas le porteur", () => {
  const limit = (over: Partial<Effect> = {}): Effect =>
    alaric({ operation: { kind: "limit-modifier", amount: 1 }, target: { factionIds: ["kherops"] }, ...over });

  it("ne propose pas de viser la figurine qui porte l'effet", () => {
    render(<Harness initial={limit()} />);
    open();
    expect(screen.queryByRole("radio", { name: /Cette figurine/i })).toBeNull();
    // Les dimensions d'identité, elles, restent : c'est par elles qu'on désigne les groupes.
    expect(screen.getByText(/^Profils$/)).toBeTruthy();
  });

  it("énonce ce que l'action fait vraiment aux groupes", () => {
    render(<Harness initial={limit()} />);
    open();
    expect(screen.getByText(/uniques ou personnages/i)).toBeTruthy();
  });

  it("retire une cible « la source » héritée en basculant sur cette action", () => {
    let last = alaric();
    render(<Harness initial={enginePowered({ target: { self: true } })} onChange={(e) => (last = e)} />);
    open();
    fireEvent.change(screen.getByRole("combobox", { name: /Action/i }), { target: { value: "limit-modifier" } });
    expect(last.target).toEqual({});
  });
});

describe("EffectListEditor - actions résolues hors du moteur", () => {
  it("énonce la cible au lieu de la proposer, et ne demande ni portée ni conditions", () => {
    render(<Harness initial={alaric()} />);
    open();
    expect(screen.getByText(/ne sait pas en viser d'autres/i)).toBeTruthy();
    expect(screen.queryByText(/^À quelles conditions$/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Périmètre/i })).toBeNull();
  });

  it("laisse cible et conditions ouvertes aux actions que le moteur résout", () => {
    render(<Harness initial={enginePowered()} />);
    open();
    expect(screen.queryByText(/ne sait pas en viser d'autres/i)).toBeNull();
    expect(screen.getByText(/^À quelles conditions$/)).toBeTruthy();
  });
});
