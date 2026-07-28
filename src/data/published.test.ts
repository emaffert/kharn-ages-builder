// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  catalog,
  clearStaleDraftNotice,
  loadCatalog,
  publishedDivergesFromFile,
  readAdminDraft,
  readPublishedCatalog,
  staleDraftWasDropped,
  writeAdminDraft,
  writePublishedCatalog,
} from "@data";
import { createMemoryStorage } from "../testing/memoryStorage";

const ADMIN_KEY = "kharn-admin-catalog-v2";
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

  it("préfère le brouillon admin quand il porte sur la version publiée courante", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "publiée" });
    writeAdminDraft(2, { ...catalog, version: "brouillon" });
    expect(loadCatalog().version).toBe("brouillon");
  });

  it("ignore un brouillon illisible et sert la version publiée", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "publiée" });
    localStorage.setItem(ADMIN_KEY, "{cassé");
    expect(loadCatalog().version).toBe("publiée");
  });
});

describe("péremption du brouillon admin", () => {
  it("abandonne un brouillon bâti sur une version publiée antérieure", () => {
    writeAdminDraft(2, { ...catalog, version: "brouillon" });
    writePublishedCatalog({ versionId: 3, publishedAt: null }, { ...catalog, version: "publiée" });
    expect(loadCatalog().version).toBe("publiée");
    expect(readAdminDraft()).toBeNull();
    expect(localStorage.getItem(ADMIN_KEY)).toBeNull();
  });

  it("annonce l'abandon, jusqu'à ce que l'admin en prenne connaissance", () => {
    writeAdminDraft(2, catalog);
    writePublishedCatalog({ versionId: 3, publishedAt: null }, catalog);
    expect(staleDraftWasDropped()).toBe(false); // rien tant que personne n'a relu le brouillon
    loadCatalog();
    expect(staleDraftWasDropped()).toBe(true);
    clearStaleDraftNotice();
    expect(staleDraftWasDropped()).toBe(false);
  });

  it("garde un brouillon local quand aucune version n'a jamais été publiée", () => {
    writeAdminDraft(null, { ...catalog, version: "brouillon" });
    expect(loadCatalog().version).toBe("brouillon");
    expect(staleDraftWasDropped()).toBe(false);
  });

  it("écarte un brouillon d'avant le versionnage, dont l'origine est inconnue", () => {
    writePublishedCatalog({ versionId: 3, publishedAt: null }, { ...catalog, version: "publiée" });
    localStorage.setItem("kharn-admin-catalog-v1", JSON.stringify({ ...catalog, version: "ancien brouillon" }));
    expect(loadCatalog().version).toBe("publiée");
    expect(localStorage.getItem("kharn-admin-catalog-v1")).toBeNull();
  });
});

describe("publishedDivergesFromFile", () => {
  it("ne signale rien tant qu'aucune version n'est publiée", () => {
    expect(publishedDivergesFromFile()).toBe(false);
  });

  it("ne signale rien quand la version publiée est identique au fichier", () => {
    writePublishedCatalog({ versionId: 1, publishedAt: null }, catalog);
    expect(publishedDivergesFromFile()).toBe(false);
  });

  it("signale que le fichier du dépôt a décroché de la version publiée", () => {
    writePublishedCatalog({ versionId: 2, publishedAt: null }, { ...catalog, version: "0.2.0" });
    expect(publishedDivergesFromFile()).toBe(true);
  });
});
