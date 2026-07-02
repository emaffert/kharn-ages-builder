import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(cleanup);

function Boom(): React.JSX.Element {
  throw new Error("boum de test");
}

describe("ErrorBoundary", () => {
  it("affiche le repli quand un enfant lève une erreur", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {}); // silence le bruit React
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Une erreur est survenue")).toBeTruthy();
    expect(screen.getByText("boum de test")).toBeTruthy();
    spy.mockRestore();
  });

  it("rend les enfants normalement sans erreur", () => {
    render(
      <ErrorBoundary>
        <p>contenu normal</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("contenu normal")).toBeTruthy();
  });
});
