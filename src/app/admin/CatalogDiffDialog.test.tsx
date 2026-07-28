// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { CatalogDiff } from "@data";
import { CatalogDiffDialog } from "./CatalogDiffDialog";

afterEach(cleanup);

const open = (diff: CatalogDiff | null) =>
  render(
    <CatalogDiffDialog
      open
      onOpenChange={() => {}}
      diff={diff}
      beforeLabel="catalog.json du dépôt"
      afterLabel="version publiée « 0.3.0 »"
    />,
  );

describe("CatalogDiffDialog", () => {
  it("annonce l'égalité quand rien n'a changé", () => {
    open({ sections: [], total: 0 });
    expect(screen.getByText(/même donnée/i)).toBeTruthy();
  });

  it("liste les entités par section, avec les champs modifiés", () => {
    open({
      total: 2,
      sections: [
        {
          key: "equipment",
          title: "Équipement",
          changes: [
            { kind: "added", id: "eq-neuf", label: "Hache neuve" },
            {
              kind: "changed",
              id: "eq-ecu",
              label: "Écu",
              hidden: 0,
              fields: [{ path: "cost", before: 12, after: 15 }],
            },
          ],
        },
      ],
    });

    expect(screen.getByRole("heading", { name: /Équipement/ })).toBeTruthy();
    expect(screen.getByText("Hache neuve")).toBeTruthy();
    expect(screen.getByText("cost")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
  });

  it("annonce une valeur absente et compte les modifications non listées", () => {
    open({
      total: 1,
      sections: [
        {
          key: "profiles",
          title: "Profils",
          changes: [
            {
              kind: "changed",
              id: "p1",
              label: "Larbin I",
              hidden: 3,
              fields: [{ path: "notes", before: undefined, after: "ajoutée" }],
            },
          ],
        },
      ],
    });

    expect(screen.getByText("-")).toBeTruthy();
    expect(screen.getByText(/3 autres modifications/)).toBeTruthy();
  });

  it("n'affiche jamais une image encodée dans la donnée", () => {
    const dataUri = `data:image/webp;base64,${"A".repeat(500)}`;
    open({
      total: 1,
      sections: [
        {
          key: "profiles",
          title: "Profils",
          changes: [
            { kind: "changed", id: "p1", label: "Larbin I", hidden: 0, fields: [{ path: "icon", before: dataUri, after: "b3f4.webp" }] },
          ],
        },
      ],
    });

    expect(screen.getByText("(image)")).toBeTruthy();
    expect(document.body.textContent).not.toContain("AAAA");
  });

  it("signale l'absence de version publiée", () => {
    open(null);
    expect(screen.getByText(/Aucune version publiée/i)).toBeTruthy();
  });
});
