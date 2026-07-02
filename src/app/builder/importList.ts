import type { Catalog, ListDocument } from "@core";
import { checkImportedList, decodeList } from "../io/listCode";
import { importText as parseTextList } from "../io/listText";

export interface ImportResolution {
  doc: ListDocument;
  /** Avertissements non bloquants (lignes texte non reconnues, version/profils incompatibles). */
  warnings: string[];
}

/**
 * Résout un import : code portable d'abord, sinon texte best-effort par nom.
 * Ajoute les avertissements de compatibilité (version de catalogue, profils inconnus).
 * Lève si rien n'est reconnu. Mutualise la logique entre l'écran d'accueil et le constructeur.
 */
export async function resolveImport(cat: Catalog, text: string): Promise<ImportResolution> {
  let doc: ListDocument;
  let warnings: string[] = [];
  try {
    doc = await decodeList(text); // code portable
  } catch {
    const r = parseTextList(cat, text); // sinon texte best-effort
    if (r.doc.fersDeLance[0].members.length === 0) {
      throw new Error("Ni code valide, ni figurine reconnue dans le texte.");
    }
    doc = r.doc;
    warnings = r.unresolved;
  }
  return { doc, warnings: [...checkImportedList(cat, doc), ...warnings] };
}
