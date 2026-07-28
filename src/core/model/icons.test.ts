import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { iconFor, mountIconFor, type Catalog } from "./index";

/**
 * Résolution des références d'icône. Les assertions portent sur la *règle de dérogation*, jamais
 * sur les valeurs du catalogue réel : celles-ci changent à chaque recadrage, la règle non.
 */

/** Catalogue réel, dont on ne remplace que ce que le test observe. */
const withIcons = (icons: Record<string, string>, over: Partial<Catalog> = {}): Catalog => ({
  ...catalog,
  icons,
  ...over,
});

const profile = catalog.profiles[0];
const mount = catalog.mounts[0];
const mountType = catalog.mountTypes.find((t) => t.id === mount.typeId)!;

describe("iconFor", () => {
  it("prend l'icône partagée par la carte quand le profil n'en a pas en propre", () => {
    const cat = withIcons(
      { [profile.cardImage]: "partagee.webp" },
      { profiles: [{ ...profile, icon: undefined }] },
    );
    expect(iconFor(cat, cat.profiles[0])).toBe("partagee.webp");
  });

  it("laisse l'icône propre au profil déroger au partage", () => {
    const cat = withIcons(
      { [profile.cardImage]: "partagee.webp" },
      { profiles: [{ ...profile, icon: "propre.webp" }] },
    );
    expect(iconFor(cat, cat.profiles[0])).toBe("propre.webp");
  });

  it("ne rend rien quand ni le profil ni sa carte n'ont d'icône", () => {
    const cat = withIcons({}, { profiles: [{ ...profile, icon: undefined }] });
    expect(iconFor(cat, cat.profiles[0])).toBeUndefined();
  });
});

describe("mountIconFor", () => {
  it("prend l'icône partagée par le type quand le niveau n'en a pas en propre", () => {
    const cat = withIcons(
      { [mountType.cardImage ?? "x"]: "type.webp" },
      { mounts: [{ ...mount, icon: undefined }], mountTypes: [{ ...mountType, cardImage: mountType.cardImage ?? "x" }] },
    );
    expect(mountIconFor(cat, cat.mounts[0])).toBe("type.webp");
  });

  it("laisse l'icône propre au niveau déroger au partage du type", () => {
    const cat = withIcons(
      { [mountType.cardImage ?? "x"]: "type.webp" },
      { mounts: [{ ...mount, icon: "niveau.webp" }], mountTypes: [{ ...mountType, cardImage: mountType.cardImage ?? "x" }] },
    );
    expect(mountIconFor(cat, cat.mounts[0])).toBe("niveau.webp");
  });

  it("ne rend rien quand le type n'a pas de carte", () => {
    const cat = withIcons(
      { "une/carte.jpg": "type.webp" },
      { mounts: [{ ...mount, icon: undefined }], mountTypes: [{ ...mountType, cardImage: undefined }] },
    );
    expect(mountIconFor(cat, cat.mounts[0])).toBeUndefined();
  });

  it("tolère une monture absente - les appelants résolvent un id qui peut ne rien donner", () => {
    expect(mountIconFor(catalog, undefined)).toBeUndefined();
  });
});
