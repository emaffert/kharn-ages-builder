import type { Catalog, Equipment, MunitionKind, MunitionType, ProfileInstance } from "../model";
import { isFreeWeapon } from "./equipment";

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

/**
 * Ce type de munition est-il achetable pour cette arme ? Seule restriction à ce jour (p.13) : « la
 * "flèche hydre" ne peut pas être utilisée avec un arc gratuit », portée par `forbiddenOnFreeWeapon`.
 */
export function munitionTypeAllowedOn(type: MunitionType, weapon: Equipment | undefined): boolean {
  return !(type.forbiddenOnFreeWeapon && isFreeWeapon(weapon));
}

/** Types de munition proposables pour une arme (l'interdit disparaît de la liste, il n'est pas grisé). */
export function munitionTypesFor(cat: Catalog, equipId: string): MunitionType[] {
  const weapon = cat.equipment.find((e) => e.id === equipId);
  const kind = munitionKindForEquip(cat, equipId);
  return (kind?.types ?? []).filter((t) => munitionTypeAllowedOn(t, weapon));
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

/**
 * Munitions achetées que cette arme n'a pas le droit de porter (vide dans le cas normal). L'interface
 * ne les propose plus, mais une liste importée ou écrite avant la règle peut encore en contenir :
 * c'est le moteur qui les refuse alors, cf. `validateMunitions`.
 */
export function forbiddenMunitionLines(cat: Catalog, inst: ProfileInstance, equipId: string): MunitionLine[] {
  const weapon = cat.equipment.find((e) => e.id === equipId);
  if (!isFreeWeapon(weapon)) return [];
  const kind = munitionKindForEquip(cat, equipId);
  return munitionLinesFor(cat, inst, equipId).filter((l) => {
    const type = kind?.types.find((t) => t.id === l.typeId);
    return type != null && !munitionTypeAllowedOn(type, weapon);
  });
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
