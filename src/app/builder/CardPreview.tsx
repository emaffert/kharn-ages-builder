import { useState } from "react";
import { Button, SegmentedControl } from "@ui";
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
  onClose,
  onAdd,
  isAtLimit,
  onInfo,
}: {
  profiles: Profile[];
  cat: Catalog;
  onClose: () => void;
  onAdd: (profileId: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
}) {
  const [id, setId] = useState(profiles[0].id);
  const p = profiles.find((pf) => pf.id === id) ?? profiles[0];
  const dependent = isDependent(p);
  const carrier = carrierLabel(p, cat);
  return (
    <div className="fe-root">
      {profiles.length > 1 && (
        <SegmentedControl
          ariaLabel="Niveau"
          value={id}
          onChange={setId}
          options={profiles.map((pf) => ({ value: pf.id, label: `${LEVEL[pf.level ?? 0]} · ${pf.cost}` }))}
        />
      )}
      <ProfileStatCard p={p} cat={cat} onInfo={onInfo} />
      <div className="fe-preview-add">
        {dependent ? (
          <p className="fe-preview-note">Se recrute via {carrier ?? "un porteur"}, pas directement.</p>
        ) : (
          <Button
            variant="primary"
            disabled={isAtLimit(p.id)}
            title={isAtLimit(p.id) ? "Limite de recrutement atteinte pour ce niveau" : undefined}
            onClick={() => {
              onAdd(p.id);
              onClose();
            }}
          >
            {isAtLimit(p.id) ? "Limite atteinte" : "Ajouter à la liste"}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
