import { describe, expect, it, vi } from "vitest";
import { pushLayer } from "./backStack";

const depth = () => (window.history.state as { khLayer?: number } | null)?.khLayer ?? 0;
const settle = () => new Promise((r) => setTimeout(r, 50));
const systemBack = async () => {
  window.history.back();
  await settle();
};

describe("pushLayer", () => {
  it("ferme la couche du dessus au retour système, puis la suivante", async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const releaseOuter = pushLayer(outer);
    pushLayer(inner);
    expect(depth()).toBe(2);

    await systemBack();
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    expect(depth()).toBe(1);

    releaseOuter();
    await settle();
    expect(outer).not.toHaveBeenCalled();
    expect(depth()).toBe(0);
  });

  it("retire autant d'entrées que de couches fermées ensemble par l'interface", async () => {
    const releaseA = pushLayer(() => {});
    const releaseB = pushLayer(() => {});
    releaseB();
    releaseA();
    await settle();
    expect(depth()).toBe(0);
  });

  it("garde la couche et son entrée quand elle refuse de se fermer", async () => {
    const onBack = vi.fn(() => false);
    const release = pushLayer(onBack);

    await systemBack();
    expect(onBack).toHaveBeenCalledOnce();
    expect(depth()).toBe(1);

    release();
    await settle();
    expect(depth()).toBe(0);
  });

  it("réutilise l'entrée d'une couche fermée dans la même tâche qu'une autre s'ouvre", async () => {
    const next = vi.fn();
    const release = pushLayer(() => {});
    release();
    pushLayer(next);
    await settle();
    expect(depth()).toBe(1);

    await systemBack();
    expect(next).toHaveBeenCalledOnce();
    expect(depth()).toBe(0);
  });
});
