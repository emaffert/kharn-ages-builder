// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalog, loadCatalog, readPublishedCatalog, writePublishedCatalog } from "@data";
import { createMemoryStorage } from "../testing/memoryStorage";

const ADMIN_KEY = "kharn-admin-catalog-v1";
const PUBLISHED_KEY = "kharn-published-catalog-v1";

beforeEach(() => vi.stubGlobal("localStorage", createMemoryStorage()));

describe("cache de la version publiée", () => {
  it("écrit puis relit une version publiée validée", () => {
    writePublishedCatalog({ versionId: 3, publishedAt: null }, { ...catalog, version: "7.7.7" });
    const cached = readPublishedCatalog();
    expect(cached?.versionId).toBe(3);
    expect(cached?.catalog.version).toBe("7.7.7");
  });

  it("ignore un cache absent, corrompu ou hors schéma", () => {
    expect(readPublishedCatalog()).toBeNull();
    localStorage.setItem(PUBLISHED_KEY, "{pas du json");
    expect(readPublishedCatalog()).toBeNull();
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify({ versionId: 1, catalog: { profiles: 3 } }));
    expect(readPublishedCatalog()).toBeNull();
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify({ catalog }));
    expect(readPublishedCatalog()).toBeNull();
  });
});

describe("loadCatalog (ordre de priorité)", () => {
  it("retombe sur le catalogue bundlé sans rien en local", () => {
    expect(loadCatalog().version).toBe(catalog.version);
  });

  it("préfère la version publiée en cache au catalogue bundlé", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "publiée" });
    expect(loadCatalog().version).toBe("publiée");
  });

  it("préfère le brouillon admin local à la version publiée", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "publiée" });
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...catalog, version: "brouillon" }));
    expect(loadCatalog().version).toBe("brouillon");
  });

  it("ignore un brouillon illisible et sert la version publiée", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "publiée" });
    localStorage.setItem(ADMIN_KEY, "{cassé");
    expect(loadCatalog().version).toBe("publiée");
  });
});
