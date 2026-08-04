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

/** Sélecteur piloté de l'extérieur : sert à rejouer le passage d'un effet à l'autre, composant monté. */
function SelectorForSelector({ selector }: { selector: Selector }) {
  return <SelectorEditor selector={selector} cat={catalog} role="target" withEquipment onChange={() => {}} />;
}

describe("SelectorEditor - la position décide des champs", () => {
  it("nomme la source selon ce qui porte l'effet", () => {
    render(<Harness sourceKind="equipment" />);
    expect(screen.getByRole("radio", { name: /Son porteur/i })).toBeTruthy();
  });

  it("expose les trois manières de désigner un ensemble", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /Cette figurine/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Toutes les figurines/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Selon des critères/i })).toBeTruthy();
  });

  it("« Toutes les figurines » écrit `all` seul et masque les critères", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ traits: ["dogon"] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Toutes les figurines/i }));
    // `all` accompagné d'un critère ne veut rien dire : la combinaison devient inatteignable.
    expect(onChange).toHaveBeenCalledWith({ all: true });
    expect(screen.queryByText(/^Traits$/)).toBeNull();
  });

  it("revenir aux critères efface `all`", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ all: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Selon des critères/i }));
    expect(onChange).toHaveBeenCalledWith({});
    expect(screen.getByText(/^Traits$/)).toBeTruthy();
  });

  it("une donnée mêlant `all` et un critère se lit pour ce qu'elle fait", () => {
    // Le critère filtre réellement : on affiche donc la branche « critères », pas « toutes ».
    render(<Harness initial={{ all: true, traits: ["dogon"] }} />);
    expect(screen.getByRole("radio", { name: /Selon des critères/i }).getAttribute("aria-checked")).toBe("true");
  });

  it("sur une monture, ne propose que le cavalier et écrit « cavalier »", () => {
    const onChange = vi.fn();
    render(<Harness sourceKind="mount" onChange={onChange} />);
    // Pas de doublon « lui-même » : sur une monture les deux désignaient la même figurine.
    expect(screen.queryByRole("radio", { name: /Cette figurine/i })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Le cavalier/i }));
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
    expect(screen.getByText(/Sur quoi porte le montant/i)).toBeTruthy();
    cleanup();
    render(<Harness role="target" />);
    expect(screen.queryByText(/Sur quoi porte le montant/i)).toBeNull();
  });

  it("replie le filtre d'équipement par défaut, et l'ouvre sur demande", () => {
    render(<Harness role="target" withEquipment />);
    expect(screen.queryByText(/^Objets précis$/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Sur certains objets/i }));
    expect(screen.getByText(/^Objets précis$/)).toBeTruthy();
  });

  it("ouvre d'emblée le filtre quand la donnée en porte un", () => {
    render(<Harness role="target" withEquipment initial={{ self: true, equipmentHands: [2] }} />);
    expect(screen.getByText(/^Objets précis$/)).toBeTruthy();
  });

  it("ouvre le filtre d'un effet filtré même après en avoir affiché un qui ne l'était pas", () => {
    // Le composant reste monté d'un effet à l'autre : un mode gardé en état local restait sur
    // « sur la figurine » et cachait le filtre (cas de la Brute, −5 Ko sur ses armes à 1 main).
    const { rerender } = render(<SelectorForSelector selector={{ self: true }} />);
    expect(screen.queryByText(/^Objets précis$/)).toBeNull();
    rerender(<SelectorForSelector selector={{ self: true, equipmentCategories: ["arme-cac"], equipmentHands: [1] }} />);
    expect(screen.getByText(/^Objets précis$/)).toBeTruthy();
  });

  it("emporte le filtre en repassant « sur la figurine »", () => {
    const onChange = vi.fn();
    render(
      <Harness role="target" withEquipment initial={{ self: true, equipmentHands: [2] }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Sur la figurine/i }));
    expect(onChange).toHaveBeenCalledWith({ self: true });
  });
});
