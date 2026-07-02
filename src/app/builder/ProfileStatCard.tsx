import { specialCardsForProfile } from "@ui/explain";
import { Tag } from "@ui";
import type { Catalog, Profile } from "@core";
import { SectionTitle } from "./components";
import { LEVEL, STATS, type ItemInfo } from "./shared";

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
export function ProfileStatCard({
  p,
  cat,
  onInfo,
}: {
  p: Profile;
  cat: Catalog;
  onInfo: (info: ItemInfo) => void;
}) {
  const cards = specialCardsForProfile(p, cat);
  const precisions = p.skills.filter((s) => s.precision);
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
        <div className="fe-stats">
          {STATS.map(([k, label]) => (
            <span key={label} className="fe-stat">
              <span className="k">{label} </span>
              <span className="v">{p.stats[k] ?? "—"}</span>
            </span>
          ))}
          <span className="fe-stat">
            <span className="k">PA </span>
            <span className="v">{p.pa}</span>
          </span>
          <span className="fe-stat">
            <span className="k">PV </span>
            <span className="v">{p.pv}</span>
          </span>
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
      </div>

      {cards.length > 0 && (
        <div>
          <SectionTitle>Cartes liées</SectionTitle>
          <div className="fe-linked">
            {cards.map((c) => (
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
        </div>
      )}
    </div>
  );
}
