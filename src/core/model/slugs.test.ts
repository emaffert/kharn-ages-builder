import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { canRenameId, isTechnicalId, slugify, suggestId, technicalIdSuggestions } from "./index";

describe("identifiants lisibles", () => {
  it("reconnaît l'identifiant que fabrique la création dans l'admin", () => {
    expect(isTechnicalId("profile-1785410170666")).toBe(true);
    expect(isTechnicalId("fangs-goulue-1")).toBe(false);
    expect(isTechnicalId("kharns-guerrier-2")).toBe(false); // un niveau n'est pas un horodatage
  });

  it("réduit un nom à un identifiant", () => {
    expect(slugify("Séduction du Fiel")).toBe("seduction-du-fiel");
    expect(slugify("L'Arbre de Vie")).toBe("l-arbre-de-vie");
    expect(slugify("  Épée à deux mains.  ")).toBe("epee-a-deux-mains");
  });

  it("sépare les homonymes par la convention du catalogue : faction, nom, niveau", () => {
    const modele = catalog.profiles.find((p) => p.id === "fangs-goulue-1")!;
    const cat = {
      ...catalog,
      profiles: [
        { ...modele, id: "profile-1700000000001", name: "Rôdeuse", level: 1 as const },
        { ...modele, id: "profile-1700000000002", name: "Rôdeuse", level: 2 as const },
        ...catalog.profiles,
      ],
    };
    expect(technicalIdSuggestions(cat).filter((s) => s.label === "Rôdeuse").map((s) => s.to)).toEqual([
      "fangs-rodeuse-1",
      "fangs-rodeuse-2",
    ]);
  });

  it("numérote deux entités que la convention ne sépare pas", () => {
    const modele = catalog.profiles.find((p) => p.id === "fangs-goulue-1")!;
    const cat = {
      ...catalog,
      profiles: [
        { ...modele, id: "profile-1700000000001", name: "Rôdeuse", level: 1 as const },
        { ...modele, id: "profile-1700000000002", name: "Rôdeuse", level: 1 as const },
        ...catalog.profiles,
      ],
    };
    expect(technicalIdSuggestions(cat).filter((s) => s.label === "Rôdeuse").map((s) => s.to)).toEqual([
      "fangs-rodeuse-1",
      "fangs-rodeuse-1-2",
    ]);
  });

  it("numérote quand la convention ne suffit pas à séparer deux entités", () => {
    const cat = {
      ...catalog,
      equipment: [
        { ...catalog.equipment[0], id: "equip-1785421869818", name: "Couteau" },
        ...catalog.equipment,
      ],
    };
    // « couteau » est déjà pris : la proposition se numérote plutôt que d'écraser.
    expect(suggestId(cat, "equipment", "equip-1785421869818")).toBe("couteau-2");
  });

  it("ne propose rien pour un identifiant que le moteur lit en dur", () => {
    expect(canRenameId("skill", "apatride")).toBe(false);
    expect(canRenameId("skill", "berserk")).toBe(false);
    expect(canRenameId("skill", "riposte")).toBe(true);
    expect(canRenameId("faction")).toBe(false);
  });

  it("propose un identifiant pour chaque entité technique du catalogue, sans collision", () => {
    const s = technicalIdSuggestions(catalog);
    // Toutes les entités techniques sont couvertes : aucune ne reste sur le carreau.
    const techniques = Object.values(catalog)
      .filter(Array.isArray)
      .flat()
      .filter((e): e is { id: string } => typeof (e as { id?: unknown })?.id === "string")
      .filter((e) => isTechnicalId(e.id));
    expect(s.length).toBe(techniques.length);
    const cibles = s.map((x) => `${x.kind}:${x.to}`);
    expect(new Set(cibles).size).toBe(cibles.length);
    expect(s.every((x) => !isTechnicalId(x.to))).toBe(true);
  });
});
