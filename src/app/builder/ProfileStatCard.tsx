import { specialCardsForProfile } from "@ui/explain";
import { Tag } from "@ui";
import type { Catalog, Profile } from "@core";
import { SectionTitle } from "./components";
import {
  LEVEL,
  STATS_COMBAT,
  STATS_SECONDARY,
  MASTERY_SHORT,
  equipInfo,
  equipBits,
  type ItemInfo,
} from "./shared";

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
export function ProfileStatCard({
  p,
  cat,
  onInfo,
  showEquipment = false,
  upgrades,
  onToggleUpgrade,
}: {
  p: Profile;
  cat: Catalog;
  onInfo: (info: ItemInfo) => void;
  showEquipment?: boolean;
  /** En édition : liste des améliorations achetées + bascule (cases à cocher dans la carte). */
  upgrades?: string[];
  onToggleUpgrade?: (id: string) => void;
}) {
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
          <h3 className="fe-card-name">
            {p.name}
            {p.level ? <span className="lvl">{LEVEL[p.level]}</span> : null}
          </h3>
          <span className="fe-cost-chip">{p.cost} Ko</span>
        </div>
        <div className="fe-taglist">
          <Tag>{limLabel}</Tag>
          {p.magic?.canCast && <Tag tone="amber">Mage</Tag>}
        </div>
        {/* Stats groupées comme sur la carte : V P A C · T I, puis PA / PV / Stature à part. */}
        <div className="fe-stats">
          <div className="fe-statrow">
            {STATS_COMBAT.map(([k, label]) => (
              <span key={label} className="fe-stat">
                <span className="k">{label}</span>
                <span className="v">{p.stats[k] ?? "—"}</span>
              </span>
            ))}
            <span className="fe-statsep" aria-hidden />
            {STATS_SECONDARY.map(([k, label]) => (
              <span key={label} className="fe-stat">
                <span className="k">{label}</span>
                <span className="v">{p.stats[k] ?? "—"}</span>
              </span>
            ))}
          </div>
          <div className="fe-statrow fe-statrow--res">
            <span className="fe-stat">
              <span className="k">PA</span>
              <span className="v">{p.pa}</span>
            </span>
            <span className="fe-stat">
              <span className="k">PV</span>
              <span className="v">{p.pv}</span>
            </span>
            <span className="fe-stat">
              <span className="k">Stature</span>
              <span className="v">{p.stature}</span>
            </span>
          </div>
        </div>
        <div className="fe-skills">
          {p.skills.map((s, i) => {
            const sk = cat.skills.find((x) => x.id === s.skillId);
            const label = `${sk?.keyword ?? s.skillId}${s.value != null ? ` ${s.value}` : ""}`;
            return (
              <button key={i} className="fe-skill" onClick={() => showSkill(s.skillId, label)}>
                {label}
              </button>
            );
          })}
        </div>
        {(p.rules.length > 0 || precisions.length > 0) && (
          <div className="fe-rules">
            {p.rules.map((r, i) => (
              <div key={i}>
                {r.label && <b>{r.label} : </b>}
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
            <span className="fe-block-label">Dés de maîtrise</span>
            <div className="fe-dice">
              {p.masteryDice.map((die, i) => (
                <span key={i} className="fe-die">
                  {die.map((d) => MASTERY_SHORT[d] ?? d).join(" · ")}
                </span>
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
                    <span className="px">{c.cost > 0 ? `+${c.cost} Ko` : "gratuit"}</span>
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
