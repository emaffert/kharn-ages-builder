import { useState, type ReactNode } from "react";
import type { Catalog, EffectSource, Selector } from "@core";
import { EQUIPMENT_CATEGORIES, INPUT } from "../admin/shared";
import { SegmentedControl } from "@ui";
import { Field, FieldGroup, NumberField, SubBlock } from "../admin/primitives";
import { ChipRow, StringList } from "./kit";
import { cleanSelector, modelOptions, profileOptions, type Option } from "./helpers";

/**
 * Un même sélecteur sert à quatre choses, et le moteur n'en lit pas les mêmes dimensions selon
 * l'endroit. Afficher partout les douze champs revenait à en proposer la moitié sans effet.
 *
 * - `target` : à qui l'effet s'applique.
 * - `condition` : ce que la liste doit contenir pour que l'effet s'active (seul endroit qui compte).
 * - `group` : le groupe de figurines qu'une opération de comptage mesure (`of`).
 * - `link` : les figurines auxquelles la cible peut être liée (garde du corps). Le constructeur
 *   n'y résout que l'identité d'un profil : pas de meneur, pas de « toutes les figurines ».
 */
export type SelectorRole = "target" | "condition" | "group" | "link";

/** Dimensions lues par le moteur pour chaque position (cf. `evaluate.ts` et `builder/shared.ts`). */
const ALLOWED: Record<SelectorRole, readonly (keyof Selector)[]> = {
  target: ["self", "cavalier", "all", "profileIds", "modelIds", "traits", "factionIds", "levels", "isLeader",
    "equipmentCategories", "equipmentIds", "equipmentHands"],
  condition: ["all", "profileIds", "modelIds", "traits", "factionIds", "levels", "isLeader", "countAtLeast"],
  group: ["all", "profileIds", "modelIds", "traits", "factionIds", "levels", "isLeader"],
  link: ["profileIds", "modelIds", "traits", "factionIds", "levels"],
};

/** Règle de lecture du bloc, énoncée une fois en tête plutôt que devinée champ par champ. */
const ROLE_NOTE: Record<SelectorRole, React.ReactNode> = {
  target: (
    <>
      L'effet s'applique aux figurines qui valident <strong>toutes</strong> les lignes renseignées.
      Dans une même ligne, correspondre à <strong>une seule</strong> valeur suffit. Tout laisser vide
      ne vise personne.
    </>
  ),
  condition: (
    <>
      La clause est vraie quand assez de figurines valident <strong>toutes</strong> les lignes
      renseignées. Dans une même ligne, <strong>une seule</strong> valeur suffit.
    </>
  ),
  group: (
    <>
      Sont comptées les figurines de la portée qui valident <strong>toutes</strong> les lignes
      renseignées. Dans une même ligne, <strong>une seule</strong> valeur suffit.
    </>
  ),
  link: (
    <>
      La figurine à laquelle la cible se lie doit valider <strong>toutes</strong> les lignes
      renseignées. Seule son identité compte ici.
    </>
  ),
};

/** Dimensions qui restreignent réellement l'ensemble visé (par opposition à `all`, qui l'ouvre). */
const CRITERIA: readonly (keyof Selector)[] = ["profileIds", "modelIds", "traits", "factionIds", "levels", "isLeader"];
const hasCriteria = (sel: Selector) =>
  CRITERIA.some((k) => { const v = sel[k]; return Array.isArray(v) ? v.length > 0 : v != null; });

/**
 * Les trois manières de désigner un ensemble, telles que le moteur les distingue vraiment.
 *
 * `all` n'est pas un critère : il lève le drapeau « au moins un critère existe » sans rien filtrer.
 * Un sélecteur vide ne vise donc personne, `all` seul vise tout le monde, et `all` accompagné d'un
 * critère ne change rien - c'est le critère qui décide. Un contrôle à trois branches rend cette
 * dernière combinaison, qui n'a aucun sens, impossible à saisir.
 */
type TargetMode = "source" | "all" | "criteria";

const ALL_NOTE = "Toutes les figurines du périmètre, sans distinction.";

/** Libellé court de la source, pour le choix segmenté (l'explication vit dans le hint). */
const SOURCE_SHORT: Record<EffectSource["kind"], string> = {
  profile: "Cette figurine",
  "special-card": "La figurine visée",
  equipment: "Son porteur",
  mount: "Le cavalier",
};

const SELF_HINT: Record<EffectSource["kind"], string> = {
  profile: "La source de l'effet, et elle seule.",
  "special-card": "Chaque figurine à laquelle la carte s'applique.",
  equipment: "Le porteur de l'objet, tant qu'il l'a sur lui.",
  mount: "Une monture n'agit que sur son cavalier : c'est la seule cible possible.",
};

/** Éditeur d'un sélecteur, réduit aux dimensions que sa position rend réellement effectives. */
export function SelectorEditor({
  selector,
  cat,
  onChange,
  role = "target",
  sourceKind = "profile",
  withEquipment = false,
  withSource = true,
  scopeField,
}: {
  selector: Selector;
  cat: Catalog;
  onChange: (s: Selector) => void;
  role?: SelectorRole;
  /** Ce qui porte l'effet : détermine le mot juste pour « la source » (cible uniquement). */
  sourceKind?: EffectSource["kind"];
  /** true : l'opération sait filtrer par équipement (`cost-delta`). Ailleurs, ces champs sont inertes. */
  withEquipment?: boolean;
  /**
   * false : l'opération ne peut pas viser la figurine qui la porte. Cas de `limit-modifier`, qui
   * vise des **groupes de recrutement** : « augmenter la limite du groupe auquel j'appartiens »
   * serait auto-référentiel, et rendrait cette limite impossible à dépasser.
   */
  withSource?: boolean;
  /**
   * Champ « Périmètre » de l'effet, rendu juste **après** le choix de cible : les deux répondent à
   * la même question (à qui), et les séparer par les critères d'identité cassait la lecture.
   */
  scopeField?: ReactNode;
}) {
  const set = (patch: Partial<Selector>) => onChange(cleanSelector({ ...selector, ...patch }));
  const has = (k: keyof Selector) => ALLOWED[role].includes(k) && (k !== "self" || withSource);
  // Une monture ne peut viser que son cavalier : `self` et `cavalier` y désignent la même figurine.
  const isMount = sourceKind === "mount";
  const sourceChecked = isMount ? (selector.cavalier ?? selector.self ?? false) : (selector.self ?? false);
  const [costMode, setCostMode] = useState<"figure" | "items">(() =>
    selector.equipmentCategories?.length || selector.equipmentIds?.length || selector.equipmentHands?.length
      ? "items"
      : "figure",
  );

  // Un critère l'emporte sur `all` dans la lecture, puisque c'est lui qui filtre réellement : une
  // donnée ancienne portant les deux s'affiche donc pour ce qu'elle fait, et se nettoie à la première
  // modification.
  const mode: TargetMode =
    has("self") && sourceChecked ? "source" : hasCriteria(selector) ? "criteria" : selector.all ? "all" : "criteria";

  const modeOptions = [
    ...(has("self") ? [{ value: "source" as const, label: SOURCE_SHORT[sourceKind] }] : []),
    ...(has("all") ? [{ value: "all" as const, label: "Toutes les figurines" }] : []),
    { value: "criteria" as const, label: "Selon des critères" },
  ];

  const switchMode = (m: TargetMode) => {
    // Le filtre d'équipement survit à toutes les bascules : « son porteur, sur ses armes à 2 mains »
    // (Ogodeï) comme « les guerriers, sur leurs armes » (Commandant) sont légitimes.
    const equip = {
      equipmentCategories: selector.equipmentCategories,
      equipmentIds: selector.equipmentIds,
      equipmentHands: selector.equipmentHands,
    };
    if (m === "source") onChange(cleanSelector({ ...(isMount ? { cavalier: true } : { self: true }), ...equip }));
    else if (m === "all") onChange(cleanSelector({ all: true, countAtLeast: selector.countAtLeast, ...equip }));
    else {
      const next: Selector = { ...selector, ...equip };
      delete next.self;
      delete next.cavalier;
      delete next.all;
      onChange(cleanSelector(next));
    }
  };

  return (
    <div className="space-y-3">
      {modeOptions.length > 1 && (
        <FieldGroup label="Qui est visé" hint={mode === "source" ? SELF_HINT[sourceKind] : undefined}>
          <SegmentedControl
            ariaLabel="Qui est visé"
            value={mode}
            onChange={switchMode}
            options={modeOptions}
          />
        </FieldGroup>
      )}

      {scopeField}

      {mode === "all" && <p className="adm-block-note">{ALL_NOTE}</p>}

      {mode === "criteria" && (
        <div className="space-y-2">
          <p className="adm-block-note">{ROLE_NOTE[role]}</p>
          <StringList
            label="Profils"
            values={selector.profileIds ?? []}
            onChange={(v) => set({ profileIds: v })}
            options={profileOptions(cat)}
            combo
          />
          <StringList
            label="Modèles"
            values={selector.modelIds ?? []}
            onChange={(v) => set({ modelIds: v })}
            options={modelOptions(cat)}
          />
          <StringList
            label="Traits"
            values={selector.traits ?? []}
            onChange={(v) => set({ traits: v })}
            placeholder="trait"
          />
          <ChipRow
            label="Niveaux"
            options={[
              { value: "1", label: "I" },
              { value: "2", label: "II" },
              { value: "3", label: "III" },
            ]}
            selected={(selector.levels ?? []).map(String)}
            onChange={(v) => set({ levels: v.length ? v.map(Number) : undefined })}
          />
          <ChipRow
            label="Factions"
            options={cat.factions.map((f): Option => ({ value: f.id, label: f.name }))}
            selected={selector.factionIds ?? []}
            onChange={(v) => set({ factionIds: v.length ? v : undefined })}
          />
          {has("isLeader") && (
            <Field label="Meneur" className="w-48">
              <select
                value={selector.isLeader == null ? "" : selector.isLeader ? "yes" : "no"}
                onChange={(e) => set({ isLeader: e.target.value === "" ? undefined : e.target.value === "yes" })}
                className={INPUT}
              >
                <option value="">indifférent</option>
                <option value="yes">est le meneur</option>
                <option value="no">n'est pas le meneur</option>
              </select>
            </Field>
          )}
        </div>
      )}

      {has("countAtLeast") && (
        <NumberField
          label="Figurines correspondantes (au moins)"
          hint="défaut : 1"
          className="w-52"
          value={selector.countAtLeast ?? null}
          onChange={(v) => set({ countAtLeast: v ?? undefined })}
        />
      )}

      {withEquipment && has("equipmentCategories") && (
        <SubBlock title="Sur quoi porte le montant">
          <FieldGroup label="Le montant s'applique">
            <SegmentedControl
              ariaLabel="Sur quoi porte le montant"
              value={costMode}
              onChange={(m) => {
                setCostMode(m);
                // Repasser « sur la figurine » emporte le filtre : il ne serait plus lu.
                if (m === "figure") {
                  set({ equipmentCategories: undefined, equipmentIds: undefined, equipmentHands: undefined });
                }
              }}
              options={[
                { value: "figure", label: "Sur la figurine" },
                { value: "items", label: "Sur certains objets" },
              ]}
            />
          </FieldGroup>
          {costMode === "items" && (
            <>
              <p className="adm-block-note">
                Le montant s'applique <strong>par objet acheté</strong> qui correspond. Un objet
                correspond dès qu'il valide <strong>l'une</strong> des trois lignes.
              </p>
              <ChipRow
                label="Catégories"
                options={EQUIPMENT_CATEGORIES.map((c): Option => ({ value: c, label: c }))}
                selected={selector.equipmentCategories ?? []}
                onChange={(v) => set({ equipmentCategories: v.length ? (v as Selector["equipmentCategories"]) : undefined })}
              />
              <StringList
                label="Objets précis"
                values={selector.equipmentIds ?? []}
                onChange={(v) => set({ equipmentIds: v })}
                options={cat.equipment.map((e) => ({ value: e.id, label: e.name }))}
                combo
              />
              <ChipRow
                label="Mains"
                options={[
                  { value: "1", label: "1 main" },
                  { value: "2", label: "2 mains" },
                ]}
                selected={(selector.equipmentHands ?? []).map(String)}
                onChange={(v) => set({ equipmentHands: v.length ? v.map(Number) : undefined })}
              />
            </>
          )}
        </SubBlock>
      )}
    </div>
  );
}

/** Sous-sélecteur `of` d'une opération de comptage, présenté comme un bloc à part entière. */
export function OfSelector({
  label,
  note,
  of,
  cat,
  onChange,
}: {
  label: string;
  note?: React.ReactNode;
  of: Selector;
  cat: Catalog;
  onChange: (s: Selector) => void;
}) {
  return (
    <div className="w-full">
      <SubBlock title={label} note={note}>
        <SelectorEditor selector={of} cat={cat} role="group" onChange={onChange} />
      </SubBlock>
    </div>
  );
}
