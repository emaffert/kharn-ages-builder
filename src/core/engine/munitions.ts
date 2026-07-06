import type { Catalog, MunitionKind, ProfileInstance } from "../model";

/**
 * Munitions achetables (règles p.46) : chaque arme de tir concernée référence une « sorte »
 * (`equipment.munitionKind` → flèches, carreaux…). L'instance stocke, par arme et par type de
 * munition, l'indice du palier de prix choisi (`inst.munitions[equipId][typeId]`).
 */

/** La sorte de munition d'une arme, si elle en accepte. */
export function munitionKindForEquip(cat: Catalog, equipId: string): MunitionKind | undefined {
  const kindId = cat.equipment.find((e) => e.id === equipId)?.munitionKind;
  return kindId ? cat.munitionKinds?.find((k) => k.id === kindId) : undefined;
}

export interface MunitionLine {
  typeId: string;
  label: string;
  tierIndex: number;
  price: number;
  qty: number;
}

/** Résout une sélection brute (`typeId → indice de palier`) en lignes de munitions. */
export function resolveMunitionLines(
  kind: MunitionKind | undefined,
  sel: Record<string, number> | undefined,
): MunitionLine[] {
  if (!kind || !sel) return [];
  const lines: MunitionLine[] = [];
  for (const [typeId, tierIndex] of Object.entries(sel)) {
    const type = kind.types.find((t) => t.id === typeId);
    const price = kind.tierPrices[tierIndex];
    const qty = type?.quantities[tierIndex];
    if (type == null || price == null || qty == null || qty <= 0) continue; // palier absent/indisponible
    lines.push({ typeId, label: type.label, tierIndex, price, qty });
  }
  return lines;
}

/** Munitions achetées pour une arme d'une instance (résolues : libellé, prix, quantité). */
export function munitionLinesFor(cat: Catalog, inst: ProfileInstance, equipId: string): MunitionLine[] {
  return resolveMunitionLines(munitionKindForEquip(cat, equipId), inst.munitions?.[equipId]);
}

/** Coût total des munitions achetées pour une arme donnée. */
export function munitionCostForEquip(cat: Catalog, inst: ProfileInstance, equipId: string): number {
  return munitionLinesFor(cat, inst, equipId).reduce((n, l) => n + l.price, 0);
}

/** Coût total des munitions d'une instance (toutes armes confondues). */
export function totalMunitionCost(cat: Catalog, inst: ProfileInstance): number {
  return Object.keys(inst.munitions ?? {}).reduce(
    (n, equipId) => n + munitionCostForEquip(cat, inst, equipId),
    0,
  );
}
