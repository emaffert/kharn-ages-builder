import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Button, Tag, Coin, SegmentedControl, Dialog, Tabs } from "./index";

afterEach(cleanup);

describe("Kit UI - primitives", () => {
  it("Button déclenche onClick et porte la variante", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Sauvegarder
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Sauvegarder" });
    expect(btn.className).toContain("ui-btn--primary");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Tag et Coin rendent leur contenu", () => {
    render(
      <>
        <Tag tone="warn">Erreur</Tag>
        <Coin value={140} />
      </>,
    );
    expect(screen.getByText("Erreur").className).toContain("ui-tag--warn");
    expect(screen.getByText("140")).toBeTruthy();
  });

  it("SegmentedControl remonte le choix", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Format"
        value="skirmish"
        onChange={onChange}
        options={[
          { value: "skirmish", label: "Escarmouche" },
          { value: "battle", label: "Bataille" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Bataille" }));
    expect(onChange).toHaveBeenCalledWith("battle");
  });

  it("Dialog s'ouvre, expose son titre et se ferme via le bouton", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen} title="Éditer la figurine">
          <p>corps</p>
        </Dialog>
      );
    }
    render(<Harness />);
    expect(screen.getByText("Éditer la figurine")).toBeTruthy();
    expect(screen.getByText("corps")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByText("corps")).toBeNull();
  });

  it("Tabs expose ses onglets et affiche le panneau par défaut", () => {
    render(
      <Tabs
        ariaLabel="Sections"
        defaultValue="gear"
        tabs={[
          { value: "card", label: "Carte", content: <div>contenu carte</div> },
          { value: "gear", label: "Équipement", content: <div>contenu équipement</div> },
        ]}
      />,
    );
    // Les deux onglets sont câblés…
    expect(screen.getByRole("tab", { name: "Carte" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Équipement" })).toBeTruthy();
    // …et c'est bien le panneau `defaultValue` qui est monté (Radix démonte les inactifs).
    expect(screen.getByText("contenu équipement")).toBeTruthy();
    expect(screen.queryByText("contenu carte")).toBeNull();
  });
});
