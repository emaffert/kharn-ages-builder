// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { loadCatalog } from "@data";
import { NewVersionNotice } from "./NewVersionNotice";
import { CatalogContext, type CatalogValue } from "../catalog/context";

afterEach(cleanup);

const withUpdate = (update: CatalogValue["update"]) =>
  render(
    <CatalogContext.Provider value={{ catalog: loadCatalog(), published: null, update, refresh: () => {} }}>
      <NewVersionNotice />
    </CatalogContext.Provider>,
  );

describe("NewVersionNotice", () => {
  it("reste absente tant qu'aucune version n'est parue", () => {
    const { container } = withUpdate(null);
    expect(container.textContent).toBe("");
  });

  it("nomme la version parue et propose de recharger", () => {
    withUpdate({ versionId: 12, publishedAt: null, version: "0.4.0" });
    expect(screen.getByText(/0\.4\.0/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recharger" })).toBeTruthy();
  });

  it("rassure sur ce qui est en cours avant d'annoncer ce qui sera perdu", () => {
    withUpdate({ versionId: 12, publishedAt: null, version: "0.4.0" });
    // Les deux moitiés du message comptent : rien n'est perdu maintenant, mais rien ne survivra au
    // rechargement. N'en dire qu'une donnerait soit une fausse alerte, soit une fausse sécurité.
    expect(screen.getByText(/Rien n'a été perdu/)).toBeTruthy();
    expect(screen.getByText(/abandonné au rechargement/)).toBeTruthy();
  });
});
