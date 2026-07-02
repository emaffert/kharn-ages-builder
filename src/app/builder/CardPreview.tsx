import { useState } from "react";
import type { Catalog, Profile } from "@core";
import { ProfileStatCard } from "./ProfileStatCard";
import { LEVEL, carrierLabel, isDependent, type ItemInfo } from "./shared";

/**
 * Aperçu d'un modèle avant recrutement : sélecteur de niveau (profils multiples), carte de stats,
 * et bouton « Ajouter à la liste » (désactivé si limite atteinte ; masqué pour un recrutement dépendant).
 */
export function CardPreview({
  profiles,
  cat,
  accent,
  deep,
  onClose,
  onAdd,
  isAtLimit,
  onInfo,
}: {
  profiles: Profile[];
  cat: Catalog;
  accent: string;
  deep: string;
  onClose: () => void;
  onAdd: (profileId: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
}) {
  const [idx, setIdx] = useState(0);
  const p = profiles[idx];
  const dependent = isDependent(p);
  const carrier = carrierLabel(p, cat);
  return (
    <div className="space-y-4">
      {profiles.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">Niveau</span>
          <div className="inline-flex overflow-hidden rounded-md" style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }}>
            {profiles.map((pf, i) => (
              <button
                key={pf.id}
                onClick={() => setIdx(i)}
                className="px-3 py-1 text-sm transition"
                style={i === idx ? { background: accent, color: "#f5ecd6" } : { color: accent }}
              >
                {LEVEL[pf.level ?? 0]} · {pf.cost}
              </button>
            ))}
          </div>
        </div>
      )}
      <ProfileStatCard p={p} cat={cat} accent={accent} deep={deep} onInfo={onInfo} />
      <div className="flex justify-end gap-2">
        {dependent ? (
          <p className="mr-auto rounded-md bg-black/5 px-3 py-2 text-xs italic opacity-70">
            Se recrute via {carrier ?? "un porteur"}, pas directement.
          </p>
        ) : (
          <button
            onClick={() => {
              onAdd(p.id);
              onClose();
            }}
            disabled={isAtLimit(p.id)}
            title={isAtLimit(p.id) ? "Limite de recrutement atteinte pour ce niveau" : undefined}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: accent }}
          >
            {isAtLimit(p.id) ? "Limite atteinte" : "Ajouter à la liste"}
          </button>
        )}
        <button onClick={onClose} className="rounded-md px-4 py-1.5 text-sm hover:bg-white/50">
          Fermer
        </button>
      </div>
    </div>
  );
}
