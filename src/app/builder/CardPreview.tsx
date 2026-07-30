import { useState } from "react";
import { Button, SegmentedControl, Dialog } from "@ui";
import { recruitCost, sealRequiredFor, type Catalog, type Profile } from "@core";
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
  factionId,
}: {
  profiles: Profile[];
  cat: Catalog;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (profileId: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
  /** Faction du Fer de Lance d'accueil : détermine le sceau imposé et donc le coût de recrutement. */
  factionId: string;
}) {
  const [id, setId] = useState(profiles[0].id);
  const p = profiles.find((pf) => pf.id === id) ?? profiles[0];
  const dependent = isDependent(p, cat);
  const carrier = carrierLabel(p, cat);
  const atLimit = isAtLimit(p.id);
  // La carte affiche son coût imprimé ; le pied annonce ce que la figurine coûtera réellement ici.
  const seal = sealRequiredFor(cat, p, factionId);
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
            {seal && (
              <span className="fe-preview-note">
                Recruté avec « {seal.name} » (+{seal.cost} Ko), soit {recruitCost(cat, p, factionId)} Ko.
              </span>
            )}
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
            options={profiles.map((pf) => ({
              value: pf.id,
              label: `${LEVEL[pf.level ?? 0]} · ${recruitCost(cat, pf, factionId)}`,
            }))}
          />
        </div>
      )}
      <ProfileStatCard
        p={p}
        cat={cat}
        onInfo={onInfo}
        showEquipment
        wornArmors={wornArmorsFrom(cat, p.baseEquipmentIds, undefined, p.armor)}
      />
    </Dialog>
  );
}
