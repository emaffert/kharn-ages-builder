import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Overlay } from "./Overlay";

afterEach(cleanup);

const pressEscape = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

describe("Overlay — touche Échap", () => {
  it("ferme la modale ouverte", () => {
    const onClose = vi.fn();
    render(<Overlay onClose={onClose}>contenu</Overlay>);
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ne ferme QUE la modale du dessus quand plusieurs sont empilées", () => {
    const bottom = vi.fn();
    const top = vi.fn();
    render(
      <>
        <Overlay onClose={bottom}>bas</Overlay>
        <Overlay onClose={top}>haut</Overlay>
      </>,
    );
    pressEscape();
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
  });

  it("retire son listener au démontage (pas de fuite)", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Overlay onClose={onClose}>x</Overlay>);
    unmount();
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });
});
