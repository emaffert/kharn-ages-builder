import { useState } from "react";
import { Button, SegmentedControl, Dialog } from "@ui";
import type { Catalog, Profile } from "@core";
import { ProfileStatCard } from "./ProfileStatCard";
import { LEVEL, carrierLabel, isDependent, wornArmorsFrom, type ItemInfo } from "./shared";

/**
 * Aperçu d'un modèle avant recrutement, rendu dans un Dialog du kit (comme l'éditeur) :
 * sélecteur de niveau, carte de stats, et pied avec coût + « Ajouter à la liste ».
 */
export function CardPreview({
  profiles,
  cat,
  title,
  open,
  onOpenChange,
  onAdd,
  isAtLimit,
  onInfo,
}: {
  profiles: Profile[];
  cat: Catalog;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (profileId: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
}) {
  const [id, setId] = useState(profiles[0].id);
  const p = profiles.find((pf) => pf.id === id) ?? profiles[0];
  const dependent = isDependent(p, cat);
  const carrier = carrierLabel(p, cat);
  const atLimit = isAtLimit(p.id);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        dependent ? (
          <>
            <span className="fe-preview-note">Se recrute via {carrier ?? "un porteur"}, pas directement.</span>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button
              variant="primary"
              disabled={atLimit}
              title={atLimit ? "Limite de recrutement atteinte pour ce niveau" : undefined}
              onClick={() => {
                onAdd(p.id);
                onOpenChange(false);
              }}
            >
              {atLimit ? "Limite atteinte" : "Ajouter à la liste"}
            </Button>
          </>
        )
      }
    >
      {profiles.length > 1 && (
        <div className="mb-3">
          <SegmentedControl
            ariaLabel="Niveau"
            value={id}
            onChange={setId}
            options={profiles.map((pf) => ({ value: pf.id, label: `${LEVEL[pf.level ?? 0]} · ${pf.cost}` }))}
          />
        </div>
      )}
      <ProfileStatCard
        p={p}
        cat={cat}
        onInfo={onInfo}
        showEquipment
        wornArmors={wornArmorsFrom(cat, p.baseEquipmentIds)}
      />
    </Dialog>
  );
}
