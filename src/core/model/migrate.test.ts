import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { parseCatalog } from "./index";

/** Catalogue valide dont on remplace le recrutement du premier profil par des contraintes d'époque. */
function legacy(recruitment: unknown[]): unknown {
  const raw = structuredClone(catalog) as { profiles: { recruitment: unknown[]; notes?: string[] }[] };
  raw.profiles[0].recruitment = recruitment;
  delete raw.profiles[0].notes;
  return raw;
}

describe("mise à niveau d'un catalogue antérieur", () => {
  it("renomme « equipment-reserved » en « forbids-grimoire »", () => {
    const parsed = parseCatalog(
      legacy([
        {
          id: "c1",
          type: "equipment-reserved",
          params: { forbidGrimoires: ["grand"] },
          scope: "profil",
          sourceText: "Ne peut pas acquérir de « Grand Grimoire ».",
          severity: "error",
        },
      ]),
    );
    expect(parsed.profiles[0].recruitment[0].type).toBe("forbids-grimoire");
    expect(parsed.profiles[0].recruitment[0].params.forbidGrimoires).toEqual(["grand"]);
  });

  it("reverse une contrainte « custom » dans les notes internes au lieu de la perdre", () => {
    const parsed = parseCatalog(
      legacy([
        { id: "c1", type: "custom", params: {}, scope: "profil", sourceText: "Règle à encoder.", severity: "error" },
      ]),
    );
    expect(parsed.profiles[0].recruitment).toEqual([]);
    expect(parsed.profiles[0].notes).toContain("Règle à encoder.");
  });

  it("replie le trait « monture-<faction> » sur le peuple d'origine", () => {
    const raw = structuredClone(catalog) as { profiles: { traits: string[]; origin?: string }[] };
    raw.profiles[0].traits = ["monture-kherops", "guerrier"];
    delete raw.profiles[0].origin;
    const parsed = parseCatalog(raw);
    expect(parsed.profiles[0].origin).toBe("kherops");
    expect(parsed.profiles[0].traits).toEqual(["guerrier"]);
  });

  it("replie les quatre flags d'armure sur un seul, effaçable", () => {
    const raw = structuredClone(catalog) as { profiles: { unverifiedFields?: string[] }[] };
    raw.profiles[0].unverifiedFields = ["stats.v", "armor.seuil", "armor.durability"];
    const parsed = parseCatalog(raw);
    expect(parsed.profiles[0].unverifiedFields).toEqual(["stats.v", "armor"]);
  });

  it("laisse intact un catalogue déjà à jour", () => {
    expect(parseCatalog(catalog)).toEqual(catalog);
  });
});

describe("noms d'affichage", () => {
  it("met une capitale initiale, quelle que soit la saisie", () => {
    const raw = structuredClone(catalog) as { equipment: { name: string }[]; skills: { keyword: string }[] };
    raw.equipment[0].name = "  épée courte ";
    raw.skills[0].keyword = "riposte";
    const parsed = parseCatalog(raw);
    expect(parsed.equipment[0].name).toBe("Épée courte");
    expect(parsed.skills[0].keyword).toBe("Riposte");
  });

  it("ne touche pas au reste du nom", () => {
    const raw = structuredClone(catalog) as { equipment: { name: string }[] };
    raw.equipment[0].name = "arc de Baruun-Urt";
    expect(parseCatalog(raw).equipment[0].name).toBe("Arc de Baruun-Urt");
  });

  it("laisse intacts les libellés qui vivent en milieu de phrase", () => {
    // « se recrute via une femelle Fang » : une capitale y serait fautive.
    const likan = parseCatalog(catalog).profiles.find((p) => p.id === "fangs-likan-1")!;
    const carrier = (likan.recruitment.find((c) => c.type === "attachment")!.params as {
      carrier: { label: string };
    }).carrier;
    expect(carrier.label).toBe("une femelle Fang");
  });
});

describe("équipement de base en plusieurs exemplaires", () => {
  /** Catalogue valide où un profil porte trois fois le même objet, à l'ancienne. */
  function repeated() {
    const raw = structuredClone(catalog) as {
      profiles: { baseEquipmentIds: string[] }[];
      equipment: { id: string; stackable?: boolean }[];
    };
    const id = raw.equipment[0].id;
    raw.profiles[0].baseEquipmentIds = [id, id, id];
    delete raw.equipment[0].stackable;
    return { raw, id };
  }

  it("replie les identifiants répétés en un objet et son nombre d'exemplaires", () => {
    const { raw, id } = repeated();
    const parsed = parseCatalog(raw);
    expect(parsed.profiles[0].baseEquipmentIds).toEqual([id]);
    expect(parsed.profiles[0].baseEquipmentCounts).toEqual({ [id]: 3 });
  });

  it("en déduit que l'objet est empilable", () => {
    const { raw, id } = repeated();
    const parsed = parseCatalog(raw);
    expect(parsed.equipment.find((e) => e.id === id)?.stackable).toBe(true);
  });

  it("ne touche pas à un équipement de base déjà normalisé", () => {
    const parsed = parseCatalog(structuredClone(catalog));
    const camériste = parsed.profiles.find((p) => p.baseEquipmentCounts != null);
    expect(new Set(camériste?.baseEquipmentIds).size).toBe(camériste?.baseEquipmentIds.length);
  });
});
