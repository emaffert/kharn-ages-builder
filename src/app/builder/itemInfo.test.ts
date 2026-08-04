import { describe, expect, it } from "vitest";
import { catalog } from "@data";
import { equipInfo, spellInfo } from "./shared";

const eq = (name: string) => catalog.equipment.find((e) => e.name === name)!;
const sp = (name: string) => catalog.spells.find((s) => s.name === name)!;
const stat = (info: ReturnType<typeof equipInfo>, label: string) =>
  info.stats?.find((s) => s.label === label);

describe("fiche d'un équipement", () => {
  it("range les valeurs en cartouche étiqueté, et tait celles qui n'existent pas", () => {
    const fronde = equipInfo(eq("Fronde"), catalog);
    expect(fronde.kind).toBe("Tir");
    expect(stat(fronde, "Portée")?.value).toBe("0 / 6 / 6");
    // Ni recharge ni munitions : aucune case ne les évoque.
    expect(stat(fronde, "Recharge")).toBeUndefined();
    expect(stat(fronde, "Munitions")).toBeUndefined();
  });

  it("nomme les munitions et leur quantité fournie", () => {
    expect(stat(equipInfo(eq("Arc de guerre"), catalog), "Munitions")?.text).toBe("12 flèches");
    // Sans quantité de départ, la sorte suffit.
    expect(stat(equipInfo(eq("Arbalète des Steppes"), catalog), "Munitions")?.text).toBe("Carreaux");
  });

  it("rend la protection d'une armure comme un tout, pas comme trois nombres", () => {
    const plate = equipInfo(eq("Armure de plate"), catalog);
    expect(stat(plate, "Protection")?.armor).toEqual({
      protectionEchec: -2,
      seuil: 6,
      protectionReussite: -3,
    });
    expect(stat(plate, "Durée de vie")?.value).toBe("10");
  });

  it("annonce « Compris » plutôt qu'un prix nul, et le texte de la carte à part", () => {
    const bol = equipInfo(eq("Bol de Millet"), catalog);
    expect(bol.prices).toEqual([]);
    expect(bol.price).toBe("Compris");
    expect(bol.text).toContain("Restaure 1D5 PV");
    expect(bol.stats).toEqual([]);
  });
});

describe("fiche d'un sort", () => {
  it("met les pages avec le prix, et n'invente rien quand il n'y a pas de Ko", () => {
    const chatiment = spellInfo(sp("Châtiment"), catalog);
    expect(chatiment.kind).toBe("Le Sang et l'Acier");
    expect(chatiment.prices).toEqual([{ value: "1", unit: "page" }]);
    expect(chatiment.price).toBe(""); // plus de « - » : 51 sorts sur 55 n'ont aucun coût
    const fiel = spellInfo(sp("Séduction du Fiel"), catalog);
    expect(fiel.prices).toEqual([
      { value: "2", unit: "pages" },
      { value: "10", unit: "Ko" },
    ]);
  });

  it("affiche cadence et durée, que la modale passait sous silence", () => {
    const chatiment = spellInfo(sp("Châtiment"), catalog);
    expect(stat(chatiment, "Cadence")?.text).toBe("2/tour");
    expect(stat(chatiment, "Durée")?.text).toBe("Immédiat.");
    expect(stat(chatiment, "Durée")?.wide).toBe(false); // courte : elle tient sur la ligne
  });

  it("laisse une durée longue prendre toute la largeur", () => {
    const duree = stat(spellInfo(sp("Séduction du Fiel"), catalog), "Durée");
    expect(duree?.text).toBe("Jusqu'à la fin de la prochaine activation du lanceur.");
    expect(duree?.wide).toBe(true);
  });

  it("expose les seuils comme une échelle ordonnée", () => {
    expect(spellInfo(sp("Châtiment"), catalog).ladder).toEqual([
      { threshold: 10, text: "I/2 dgts" },
      { threshold: 16, text: "I dgts" },
      { threshold: 24, text: "I+T dgts" },
    ]);
  });
});
