import { specialCardsForProfile } from "@ui/explain";
import type { Catalog, Profile } from "@core";
import { SectionTitle, Tag } from "./components";
import { LEVEL, STATS, type ItemInfo } from "./shared";

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
export function ProfileStatCard({
  p,
  cat,
  accent,
  deep,
  onInfo,
}: {
  p: Profile;
  cat: Catalog;
  accent: string;
  deep: string;
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
    <div className="grid gap-5 md:grid-cols-[1fr_240px]">
      <div className="rounded-lg border-2 bg-white/40 p-4" style={{ borderColor: accent }}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="kh-display text-2xl font-bold leading-tight" style={{ color: deep }}>
            {p.name}
            {p.level && <span className="ml-2 text-lg opacity-60">{LEVEL[p.level]}</span>}
          </h3>
          <span className="rounded px-2 py-0.5 text-sm font-semibold text-white" style={{ background: accent }}>
            {p.cost} Ko
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <Tag accent={accent}>{limLabel}</Tag>
          {p.magic?.canCast && <Tag accent={accent}>Mage</Tag>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {STATS.map(([k, label]) => (
            <span key={label} className="rounded bg-black/5 px-2 py-1 text-sm">
              <span className="opacity-50">{label} </span>
              <span className="font-semibold">{p.stats[k] ?? "—"}</span>
            </span>
          ))}
          <span className="rounded bg-black/5 px-2 py-1 text-sm">
            <span className="opacity-50">PA </span>
            <span className="font-semibold">{p.pa}</span>
          </span>
          <span className="rounded bg-black/5 px-2 py-1 text-sm">
            <span className="opacity-50">PV </span>
            <span className="font-semibold">{p.pv}</span>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {p.skills.map((s, i) => {
            const sk = cat.skills.find((x) => x.id === s.skillId);
            const label = `${sk?.keyword ?? s.skillId}${s.value != null ? ` ${s.value}` : ""}`;
            return (
              <button
                key={i}
                onClick={() => showSkill(s.skillId, label)}
                className="rounded-full bg-black/5 px-2 py-0.5 text-xs transition hover:bg-black/10"
                style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(p.rules.length > 0 || precisions.length > 0) && (
          <ul className="mt-3 space-y-1 text-sm">
            {p.rules.map((r, i) => (
              <li key={i}>
                {r.label && (
                  <span className="font-semibold" style={{ color: deep }}>
                    {r.label} :{" "}
                  </span>
                )}
                {r.text}
              </li>
            ))}
            {precisions.map((s, i) => {
              const kw = cat.skills.find((x) => x.id === s.skillId)?.keyword ?? s.skillId;
              return (
                <li key={`prec-${i}`}>
                  <button
                    onClick={() => showSkill(s.skillId, kw)}
                    className="font-semibold underline decoration-dotted underline-offset-2 transition hover:opacity-70"
                    style={{ color: deep }}
                  >
                    {kw}
                  </button>{" "}
                  : {s.precision}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cards.length > 0 && (
        <div>
          <SectionTitle accent={accent}>Cartes liées</SectionTitle>
          <ul className="space-y-1 text-sm">
            {cards.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() =>
                    onInfo({ title: c.name, price: c.cost > 0 ? `${c.cost} Ko` : "auto", lines: c.rulesText.map((r) => r.text) })
                  }
                  className="flex w-full justify-between rounded bg-white/40 px-2 py-1 text-left transition hover:bg-white/70"
                >
                  <span>{c.name}</span>
                  <span className="opacity-60">{c.cost > 0 ? `${c.cost} Ko` : "auto"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
