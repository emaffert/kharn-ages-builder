import { useState } from "react";
import { Button, SegmentedControl, Dialog } from "@ui";
import { needsOriginChoice, recruitCost, sealRequiredFor, type Catalog, type Profile } from "@core";
import { ProfileStatCard } from "./ProfileStatCard";
import { LEVEL, carrierLabel, isDependent, originOptions, wornArmorsFrom, type ItemInfo } from "./shared";

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
  /** `origin` : peuple retenu, pour les cartes qui laissent le choix (cf. `originChoices`). */
  onAdd: (profileId: string, origin?: string) => void;
  isAtLimit: (profileId: string) => boolean;
  onInfo: (info: ItemInfo) => void;
  /** Faction du Fer de Lance d'accueil : détermine le sceau imposé et donc le coût de recrutement. */
  factionId: string;
}) {
  const [id, setId] = useState(profiles[0].id);
  const p = profiles.find((pf) => pf.id === id) ?? profiles[0];
  // Peuple d'origine : second choix de recrutement, à côté du niveau, pour les cartes qui le laissent
  // au joueur (Agent sombre). Rien à afficher ailleurs.
  const peuples = originOptions(cat, p);
  const [origin, setOrigin] = useState(peuples[0]?.id);
  const originManquante = needsOriginChoice(p) && !peuples.some((f) => f.id === origin);
  const dependent = isDependent(p, cat, factionId);
  const carrier = carrierLabel(p, cat, factionId);
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
              disabled={atLimit || originManquante}
              title={atLimit ? "Limite de recrutement atteinte pour ce niveau" : undefined}
              onClick={() => {
                onAdd(p.id, needsOriginChoice(p) ? origin : undefined);
                onOpenChange(false);
              }}
            >
              {atLimit ? "Limite atteinte" : "Ajouter à la liste"}
            </Button>
          </>
        )
      }
    >
      {/* Ce qui reste à décider avant de recruter, sur une même rangée en tête de carte : le niveau
          et, pour les cartes qui le laissent au joueur, le peuple d'origine. */}
      {(profiles.length > 1 || peuples.length > 0) && (
        <div className="fe-preview-picks">
          {profiles.length > 1 && (
            <label className="fe-preview-pick">
              <span className="lbl">Niveau</span>
              <SegmentedControl
                ariaLabel="Niveau"
                value={id}
                onChange={setId}
                options={profiles.map((pf) => ({
                  value: pf.id,
                  label: `${LEVEL[pf.level ?? 0]} · ${recruitCost(cat, pf, factionId)}`,
                }))}
              />
            </label>
          )}
          {peuples.length > 0 && (
            <label className="fe-preview-pick">
              <span className="lbl">Peuple d'origine</span>
              <SegmentedControl
                ariaLabel="Peuple d'origine"
                value={origin ?? ""}
                onChange={setOrigin}
                options={peuples.map((f) => ({ value: f.id, label: f.name }))}
              />
            </label>
          )}
        </div>
      )}
      <ProfileStatCard
        p={p}
        cat={cat}
        onInfo={onInfo}
        showEquipment
        wornArmors={wornArmorsFrom(cat, p.baseEquipmentIds, undefined, p.armor)}
        factionId={factionId}
      />
    </Dialog>
  );
}
