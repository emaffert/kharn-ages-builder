import { specialCardsForProfile } from "@ui/explain";
import { Tag } from "@ui";
import { iconFor, type Catalog, type Profile } from "@core";
import { SectionTitle } from "./components";
import { MasteryDie } from "./MasteryDie";
import {
  LEVEL,
  STATS_COMBAT,
  STATS_SECONDARY,
  equipInfo,
  equipBits,
  spellInfo,
  type ItemInfo,
} from "./shared";

/** Modifications apportées par des effets (pour l'affichage : couleur « braise » + infobulle). */
export type ProfileMods = {
  statDeltas?: Record<string, number>;
  /** Valeurs de compétences calculées par effet (skillId -> valeur), ex. Seigneur de guerre. */
  skillValues?: Record<string, number>;
  grantedSkillIds?: string[];
  grantedTraitIds?: string[];
};

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
export function ProfileStatCard({
  p,
  cat,
  onInfo,
  showEquipment = false,
  upgrades,
  onToggleUpgrade,
  mods,
}: {
  p: Profile;
  cat: Catalog;
  onInfo: (info: ItemInfo) => void;
  showEquipment?: boolean;
  /** En édition : liste des améliorations achetées + bascule (cases à cocher dans la carte). */
  upgrades?: string[];
  onToggleUpgrade?: (id: string) => void;
  /** Modifications d'effets à refléter sur le profil affiché (stats/compétences/traits). */
  mods?: ProfileMods;
}) {
  // Rend une caractéristique en tenant compte d'un éventuel modificateur d'effet.
  const statCell = (k: string, label: string, base: number | null | undefined) => {
    const d = mods?.statDeltas?.[k];
    const value = d != null ? (typeof base === "number" ? base : 0) + d : base;
    return (
      <span key={label} className="fe-stat">
        <span className="k">{label}</span>
        <span
          className={`v${d != null ? " is-fx" : ""}`}
          title={d != null ? `base ${base ?? "—"}, ${d > 0 ? "+" : ""}${d} (effet)` : undefined}
        >
          {value ?? "—"}
        </span>
      </span>
    );
  };
  const grantedSkillIds = (mods?.grantedSkillIds ?? []).filter((id) => !p.skills.some((s) => s.skillId === id));
  const grantedTraits = mods?.grantedTraitIds ?? [];
  // Sorts connus d'office (signature) — affichés même pour les non-mages, cliquables.
  const innateSpells = (p.magic?.knownReservedSpellIds ?? [])
    .map((id) => cat.spells.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const cards = specialCardsForProfile(p, cat);
  const autoCards = cards.filter((c) => !c.amelioration); // appliquées d'office
  const ameliorations = cards.filter((c) => c.amelioration); // achetables
  const canEditUpgrades = Boolean(onToggleUpgrade);
  const precisions = p.skills.filter((s) => s.precision);
  const baseEq = p.baseEquipmentIds
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const showSkill = (skillId: string, label: string) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    onInfo({ title: label, price: "compétence", lines: [sk?.sourceText ?? "Description indisponible."] });
  };
  const limLabel =
    p.limitation.kind === "special"
      ? "Limitation •"
      : `Limitation ${p.limitation.kind}${p.limitation.value != null ? ` ${p.limitation.value}` : ""}`;
  return (
    <div className="fe-statcard">
      <div className="fe-card">
        <div className="fe-card-head">
          <div className="fe-headmain">
            {iconFor(cat, p) && <img className="fe-portrait" src={iconFor(cat, p)} alt="" />}
            <h3 className="fe-card-name">
              {p.name}
              {p.level ? <span className="lvl">{LEVEL[p.level]}</span> : null}
            </h3>
          </div>
          <span className="fe-cost-chip">{p.cost} Ko</span>
        </div>
        <div className="fe-taglist">
          <Tag>{limLabel}</Tag>
          {p.magic?.canCast && <Tag tone="amber">Mage</Tag>}
          {grantedTraits.map((t) => (
            <span key={t} className="fe-fx-tag" title="Trait octroyé par un effet">
              {t}
            </span>
          ))}
        </div>
        {/* Stats groupées comme sur la carte : V P A C · T I, puis PA / PV / Stature à part. */}
        <div className="fe-stats">
          <div className="fe-statrow">
            {STATS_COMBAT.map(([k, label]) => statCell(k, label, p.stats[k]))}
            <span className="fe-statsep" aria-hidden />
            {STATS_SECONDARY.map(([k, label]) => statCell(k, label, p.stats[k]))}
          </div>
          <div className="fe-statrow fe-statrow--res">
            {statCell("pa", "PA", p.pa)}
            {statCell("pv", "PV", p.pv)}
            {statCell("stature", "Stature", p.stature)}
          </div>
        </div>
        <div className="fe-skills">
          {p.skills.map((s, i) => {
            const sk = cat.skills.find((x) => x.id === s.skillId);
            const fxVal = mods?.skillValues?.[s.skillId]; // valeur calculée par un effet (ex. Seigneur de guerre)
            const value = fxVal ?? s.value;
            const label = `${sk?.keyword ?? s.skillId}${value != null ? ` ${value}` : ""}`;
            return (
              <button
                key={i}
                className={`fe-skill${fxVal != null ? " is-fx" : ""}`}
                onClick={() => showSkill(s.skillId, label)}
                title={fxVal != null ? "Valeur calculée par un effet" : undefined}
              >
                {label}
              </button>
            );
          })}
          {grantedSkillIds.map((id) => {
            const sk = cat.skills.find((x) => x.id === id);
            const label = sk?.keyword ?? id;
            return (
              <button
                key={`g-${id}`}
                className="fe-skill is-fx"
                onClick={() => showSkill(id, label)}
                title="Compétence octroyée par un effet"
              >
                {label}
              </button>
            );
          })}
        </div>
        {(p.rules.length > 0 || precisions.length > 0) && (
          <div className="fe-rules">
            {p.rules.map((r, i) => (
              <div key={i}>
                {r.label && <b>{r.label}{r.text ? " : " : ""}</b>}
                {r.text}
              </div>
            ))}
            {precisions.map((s, i) => {
              const kw = cat.skills.find((x) => x.id === s.skillId)?.keyword ?? s.skillId;
              return (
                <div key={`prec-${i}`}>
                  <button className="fe-rule-btn" onClick={() => showSkill(s.skillId, kw)}>
                    {kw}
                  </button>{" "}
                  : {s.precision}
                </div>
              );
            })}
          </div>
        )}
        {/* Dés de maîtrise : tout en bas de la carte (comme sur la carte officielle). */}
        {p.masteryDice.length > 0 && (
          <div className="fe-mastery">
            <div className="fe-dice">
              {p.masteryDice.map((die, i) => (
                <MasteryDie key={i} domains={die} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Colonne latérale : améliorations (cochables en édition) + cartes liées automatiques. */}
      <div className="fe-aside">
        {ameliorations.length > 0 && (
          <div>
            <SectionTitle>Améliorations</SectionTitle>
            {canEditUpgrades ? (
              <div className="fe-col">
                {ameliorations.map((c) => (
                  <label key={c.id} className="fe-check">
                    <input
                      type="checkbox"
                      checked={upgrades?.includes(c.id) ?? false}
                      onChange={() => onToggleUpgrade?.(c.id)}
                    />
                    <button
                      className="nm"
                      onClick={() =>
                        onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "gratuit", lines: c.rulesText.map((r) => r.text) })
                      }
                      title="Voir le détail"
                    >
                      {c.name}
                    </button>
                    <span className="px">
                      {c.cost > 0 ? `+${c.cost} Ko` : "gratuit"}
                      {c.shared ? " · partagée" : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="fe-linked">
                {ameliorations.map((c) => (
                  <button
                    key={c.id}
                    className="fe-linked-item"
                    onClick={() =>
                      onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "auto", lines: c.rulesText.map((r) => r.text) })
                    }
                  >
                    <span>{c.name}</span>
                    <span className="px">{c.cost > 0 ? `${c.cost} Ko` : "auto"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {innateSpells.length > 0 && (
          <div>
            <SectionTitle>Magie</SectionTitle>
            <div className="fe-linked">
              {innateSpells.map((s) => (
                <button
                  key={s.id}
                  className="fe-linked-item"
                  onClick={() => onInfo(spellInfo(s, cat))}
                  title="Sort connu d'office — voir le détail"
                >
                  <span>{s.name}</span>
                  <span className="px">{s.cost ? `${s.cost} Ko` : "d'office"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Libellé toujours présent (même vide) pour un gabarit de carte constant. */}
        <div>
          <SectionTitle>Cartes liées</SectionTitle>
          {autoCards.length > 0 ? (
            <div className="fe-linked">
              {autoCards.map((c) => (
                <button
                  key={c.id}
                  className="fe-linked-item"
                  onClick={() =>
                    onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "auto", lines: c.rulesText.map((r) => r.text) })
                  }
                >
                  <span>{c.name}</span>
                  <span className="px">{c.cost > 0 ? `${c.cost} Ko` : "auto"}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="fe-mag-bonus">Aucune.</p>
          )}
        </div>
      </div>

      {/* Équipement : colonne de gauche, uniquement à l'aperçu roster (l'éditeur a son onglet). Libellé toujours présent. */}
      {showEquipment && (
        <div className="fe-eq-section">
          <SectionTitle>Équipement</SectionTitle>
          {baseEq.length > 0 ? (
            <div className="fe-eqrow">
              {baseEq.map((e) => (
                <button key={e.id} className="fe-eq" onClick={() => onInfo(equipInfo(e))} title="Voir le détail">
                  <span className="nm">{e.name}</span>
                  {equipBits(e) && <span className="bits">{equipBits(e)}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="fe-mag-bonus">Aucun.</p>
          )}
        </div>
      )}
    </div>
  );
}
