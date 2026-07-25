import { describe, it, expect } from "vitest";
import type { ListDocument } from "@core";
import { reconcileLists } from "./merge";

/** Liste minimale : seuls `id` et `updatedAt` comptent pour la réconciliation. */
const doc = (id: string, updatedAt: string, name = id): ListDocument =>
  ({
    schemaVersion: "1",
    catalogVersion: "1",
    id,
    name,
    format: "escarmouche",
    createdAt: updatedAt,
    updatedAt,
    fersDeLance: [],
    snapshot: { totalCost: 0, entries: [] },
  }) as ListDocument;

const ids = (docs: { id: string }[]) => docs.map((d) => d.id).sort();

describe("reconcileLists", () => {
  it("téléverse les listes créées sans compte", () => {
    const r = reconcileLists([doc("a", "2026-07-01T10:00:00Z")], []);
    expect(ids(r.merged)).toEqual(["a"]);
    expect(ids(r.toUpload)).toEqual(["a"]);
    expect(r.toCache).toEqual([]);
  });

  it("rapatrie les listes venues d'un autre appareil", () => {
    const r = reconcileLists([], [doc("b", "2026-07-01T10:00:00Z")]);
    expect(ids(r.toCache)).toEqual(["b"]);
    expect(ids(r.merged)).toEqual(["b"]);
    expect(r.toUpload).toEqual([]);
  });

  it("garde la version la plus récente en cas de divergence (locale gagnante)", () => {
    const r = reconcileLists(
      [doc("a", "2026-07-02T10:00:00Z", "récente")],
      [doc("a", "2026-07-01T10:00:00Z", "ancienne")],
    );
    expect(r.merged[0].name).toBe("récente");
    expect(ids(r.toUpload)).toEqual(["a"]);
    expect(r.toCache).toEqual([]);
  });

  it("garde la version la plus récente en cas de divergence (distante gagnante)", () => {
    const r = reconcileLists(
      [doc("a", "2026-07-01T10:00:00Z", "ancienne")],
      [doc("a", "2026-07-03T10:00:00Z", "récente")],
    );
    expect(r.merged[0].name).toBe("récente");
    expect(ids(r.toCache)).toEqual(["a"]);
    expect(r.toUpload).toEqual([]);
  });

  it("ne transfère rien quand les deux côtés sont à la même date", () => {
    const r = reconcileLists([doc("a", "2026-07-01T10:00:00Z")], [doc("a", "2026-07-01T10:00:00Z")]);
    expect(ids(r.merged)).toEqual(["a"]);
    expect(r.toUpload).toEqual([]);
    expect(r.toCache).toEqual([]);
  });

  it("propage une suppression faite hors-ligne au lieu de ressusciter la liste", () => {
    const r = reconcileLists([], [doc("a", "2026-07-05T10:00:00Z")], ["a"]);
    expect(r.merged).toEqual([]);
    expect(r.toDeleteRemote).toEqual(["a"]);
    expect(r.toCache).toEqual([]);
  });

  it("fait primer la suppression sur une version distante plus récente", () => {
    const r = reconcileLists([doc("a", "2026-07-01T10:00:00Z")], [doc("a", "2026-07-09T10:00:00Z")], ["a"]);
    expect(r.merged).toEqual([]);
    expect(r.toDeleteRemote).toEqual(["a"]);
  });

  it("ignore une pierre tombale sans équivalent distant", () => {
    const r = reconcileLists([], [], ["disparue"]);
    expect(r.toDeleteRemote).toEqual([]);
    expect(r.merged).toEqual([]);
  });

  it("fusionne les deux bibliothèques, plus récentes d'abord", () => {
    const r = reconcileLists(
      [doc("a", "2026-07-01T10:00:00Z"), doc("b", "2026-07-04T10:00:00Z")],
      [doc("c", "2026-07-03T10:00:00Z")],
    );
    expect(r.merged.map((d) => d.id)).toEqual(["b", "c", "a"]);
    expect(ids(r.toUpload)).toEqual(["a", "b"]);
    expect(ids(r.toCache)).toEqual(["c"]);
  });
});
