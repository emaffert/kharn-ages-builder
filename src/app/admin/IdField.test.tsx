// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { renameId } from "@core";
import { catalog as base } from "@data";
import { IdField } from "./primitives";

afterEach(cleanup);

/** Le champ vit sur un catalogue réel : c'est lui qui fournit références et unicité. */
function Harness({ id = "couteau", onRename = () => {} }: { id?: string; onRename?: (v: string) => void }) {
  const [cat] = useState(base);
  return <IdField cat={cat} kind="equipment" id={id} onRename={onRename} />;
}

// Ciblé par rôle : la valeur peut être vide ou blanche pendant la saisie.
const field = () => screen.getByRole("textbox") as HTMLInputElement;

describe("IdField", () => {
  it("annonce combien de références suivront avant de valider", () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: "dague-de-ceinture" } });
    expect(screen.getByText(/références suivront/i)).toBeTruthy();
  });

  it("renomme à la validation", () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.change(field(), { target: { value: "dague-de-ceinture" } });
    fireEvent.blur(field());
    expect(onRename).toHaveBeenCalledWith("dague-de-ceinture");
  });

  it("refuse un identifiant déjà pris", () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.change(field(), { target: { value: "brigandine" } });
    expect(screen.getByText(/déjà pris/i)).toBeTruthy();
    fireEvent.blur(field());
    expect(onRename).not.toHaveBeenCalled();
  });

  it("refuse un identifiant vide", () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.change(field(), { target: { value: "   " } });
    fireEvent.blur(field());
    expect(onRename).not.toHaveBeenCalled();
  });

  it("abandonne la saisie sur Échap", () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.change(field(), { target: { value: "autre" } });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(field().value).toBe("couteau");
    fireEvent.blur(field());
    expect(onRename).not.toHaveBeenCalled();
  });

  it("montre en lecture seule un identifiant figé par le code", () => {
    render(<IdField cat={base} kind="grimoire" id="petit" onRename={() => {}} />);
    expect(screen.queryByDisplayValue("petit")).toBeNull();
    expect(screen.getByText("petit")).toBeTruthy();
  });
});

describe("cascade appliquée", () => {
  it("le renommage suit les références du catalogue réel", () => {
    const next = renameId(base, "equipment", "couteau", "dague-de-ceinture");
    expect(next.profiles.find((p) => p.id === "fangs-goulue-1")!.baseEquipmentIds).toContain("dague-de-ceinture");
  });
});
