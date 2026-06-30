import { useMemo, useState, type ReactNode } from "react";
import type { Catalog, Constraint, Effect, Profile } from "@core";
import { describeConstraint, describeEffect, specialCardsForProfile } from "@ui/explain";
import { useCatalogStore, type FieldValue } from "./useCatalogStore";

const STAT_LABELS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

const LEVEL_LABEL = ["", "I", "II", "III"];

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-700/60 text-slate-200",
    red: "bg-red-900/50 text-red-200 ring-1 ring-red-700/40",
    amber: "bg-amber-900/40 text-amber-200 ring-1 ring-amber-700/40",
    green: "bg-emerald-900/40 text-emerald-200 ring-1 ring-emerald-700/40",
    violet: "bg-violet-900/40 text-violet-200 ring-1 ring-violet-700/40",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">{title}</h3>
      {children}
    </section>
  );
}

function FlagButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Lecture incertaine (cliquer pour valider)" : "Marquer comme « à vérifier »"}
      className={`leading-none ${active ? "text-amber-400" : "text-slate-600 hover:text-slate-400"}`}
    >
      ⚠
    </button>
  );
}

function EditableNumber({
  label,
  value,
  unverified,
  onChange,
  onToggle,
}: {
  label: string;
  value: number | null;
  unverified: boolean;
  onChange: (v: FieldValue) => void;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-1 rounded px-2 py-1 ${
        unverified ? "bg-amber-950/40 ring-1 ring-amber-600/60" : "bg-slate-800"
      }`}
    >
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-12 bg-transparent font-semibold text-slate-100 outline-none"
      />
      <FlagButton active={unverified} onClick={onToggle} />
    </label>
  );
}

function RuleCard({
  human,
  sourceText,
  badges,
}: {
  human: string;
  sourceText: string;
  badges: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-800/40 p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
      <p className="text-sm text-slate-100">{human}</p>
      <p className="border-l-2 border-amber-600/50 pl-2 text-xs italic text-slate-400">
        « {sourceText} »
      </p>
    </div>
  );
}

interface DetailProps {
  profile: Profile;
  cat: Catalog;
  updateField: (id: string, path: string, value: FieldValue) => void;
  toggleUnverified: (id: string, key: string) => void;
}

function ProfileDetail({ profile, cat, updateField, toggleUnverified }: DetailProps) {
  const equipById = useMemo(() => new Map(cat.equipment.map((e) => [e.id, e])), [cat]);
  const cards = specialCardsForProfile(profile, cat);
  const uv = (key: string) => profile.unverifiedFields?.includes(key) ?? false;
  const upd = (path: string, v: FieldValue) => updateField(profile.id, path, v);
  const flag = (key: string) => toggleUnverified(profile.id, key);

  const constraints: { c: Constraint; via?: string }[] = [
    ...profile.recruitment.map((c) => ({ c })),
    ...cards.flatMap((card) => card.constraints.map((c) => ({ c, via: card.name }))),
  ];
  const effects: { e: Effect; via?: string }[] = [
    ...(profile.effects ?? []).map((e) => ({ e })),
    ...cards.flatMap((card) => card.effects.map((e) => ({ e, via: card.name }))),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            value={profile.name}
            onChange={(e) => upd("name", e.target.value)}
            className="flex-1 rounded bg-slate-800 px-2 py-1 text-2xl font-bold text-slate-50 outline-none ring-1 ring-transparent focus:ring-amber-600"
          />
          <label className="flex items-center gap-1 text-amber-300">
            <input
              type="number"
              value={profile.cost}
              onChange={(e) => upd("cost", Number(e.target.value))}
              className="w-16 rounded bg-slate-800 px-2 py-1 text-right text-xl font-semibold outline-none focus:ring-1 focus:ring-amber-600"
            />
            <span className="text-sm">Ko</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profile.level && <Badge tone="violet">Niveau {LEVEL_LABEL[profile.level]}</Badge>}
          <Badge>{profile.factionId ?? "sans logo"}</Badge>
          <Badge tone="amber">
            Limitation {profile.limitation.kind}
            {profile.limitation.value ? ` ${profile.limitation.value}` : ""}
          </Badge>
          {profile.isNamed && <Badge tone="violet">Personnage</Badge>}
          {profile.magic?.canCast && <Badge tone="green">Mage</Badge>}
          {profile.cardCode && <Badge>{profile.cardCode}</Badge>}
        </div>
      </header>

      <Section title="Caractéristiques (modifiables — ⚠ = lecture à vérifier)">
        <div className="flex flex-wrap gap-2">
          {STAT_LABELS.map(([k, label]) => (
            <EditableNumber
              key={label}
              label={label}
              value={profile.stats[k]}
              unverified={uv(`stats.${k}`)}
              onChange={(v) => upd(`stats.${k}`, v)}
              onToggle={() => flag(`stats.${k}`)}
            />
          ))}
          <EditableNumber
            label="Stature"
            value={profile.stature}
            unverified={uv("stature")}
            onChange={(v) => upd("stature", v ?? 0)}
            onToggle={() => flag("stature")}
          />
          <EditableNumber
            label="PA"
            value={profile.pa}
            unverified={uv("pa")}
            onChange={(v) => upd("pa", v ?? 0)}
            onToggle={() => flag("pa")}
          />
          <EditableNumber
            label="PV"
            value={profile.pv}
            unverified={uv("pv")}
            onChange={(v) => upd("pv", v ?? 0)}
            onToggle={() => flag("pv")}
          />
        </div>
      </Section>

      <Section title="Dés de maîtrise">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-sm ${
              uv("masteryDice") ? "bg-amber-950/40 ring-1 ring-amber-600/60" : "bg-slate-800"
            }`}
          >
            {profile.masteryDice.join(", ") || "—"}
          </span>
          <FlagButton active={uv("masteryDice")} onClick={() => flag("masteryDice")} />
        </div>
      </Section>

      <Section title="Compétences">
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.length === 0 && <span className="text-sm text-slate-500">Aucune.</span>}
          {profile.skills.map((s, idx) => (
            <Badge key={`${s.skillId}-${idx}`}>
              {cat.skills.find((sk) => sk.id === s.skillId)?.keyword ?? s.skillId}
              {s.value != null ? ` ${s.value}` : ""}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Équipement de base">
        <ul className="space-y-1 text-sm text-slate-200">
          {profile.baseEquipmentIds.length === 0 && (
            <li className="text-slate-500">Aucun (mains nues).</li>
          )}
          {profile.baseEquipmentIds.map((id) => {
            const e = equipById.get(id);
            return (
              <li key={id} className="flex justify-between">
                <span>{e?.name ?? id}</span>
                <span className="text-slate-400">{e ? `${e.cost} Ko` : "?"}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Contraintes (validées par le moteur)">
        {constraints.length === 0 && <p className="text-sm text-slate-500">Aucune.</p>}
        <div className="space-y-2">
          {constraints.map(({ c, via }, idx) => (
            <RuleCard
              key={`${c.id}-${idx}`}
              human={describeConstraint(c, cat)}
              sourceText={c.sourceText}
              badges={
                <>
                  <Badge tone={c.severity === "error" ? "red" : "amber"}>{c.severity}</Badge>
                  <Badge tone={c.autoEnforced ? "green" : "slate"}>
                    {c.autoEnforced ? "auto-vérifiée" : "note (non vérifiée)"}
                  </Badge>
                  <Badge>{c.type}</Badge>
                  {via && <Badge tone="violet">via « {via} »</Badge>}
                </>
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Effets / octrois">
        {effects.length === 0 && <p className="text-sm text-slate-500">Aucun.</p>}
        <div className="space-y-2">
          {effects.map(({ e, via }, idx) => (
            <RuleCard
              key={`${e.id}-${idx}`}
              human={describeEffect(e, cat)}
              sourceText={e.sourceText}
              badges={
                <>
                  <Badge tone={e.appliesToListBuilding ? "green" : "slate"}>
                    {e.appliesToListBuilding ? "calculé par l'éditeur" : "en jeu seulement"}
                  </Badge>
                  <Badge>{e.operation.kind}</Badge>
                  {via && <Badge tone="violet">via « {via} »</Badge>}
                </>
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Règles de la carte (verbatim — fait foi)">
        <ul className="space-y-1 text-sm">
          {profile.rules.length === 0 && <li className="text-slate-500">Aucune.</li>}
          {profile.rules.map((r, idx) => (
            <li key={idx} className="text-slate-200">
              {r.label && <span className="font-semibold text-amber-300/90">{r.label} : </span>}
              {r.text}
            </li>
          ))}
        </ul>
      </Section>

      {import.meta.env.DEV && (
        <Section title="Carte (aperçu — dev uniquement)">
          <img
            src={`/${profile.cardImage}`}
            alt={`Carte de ${profile.name}`}
            loading="lazy"
            className="max-h-[460px] w-auto rounded border border-slate-700"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </Section>
      )}

      <p className="text-xs text-slate-600">Carte : {profile.cardImage}</p>
    </div>
  );
}

export function AdminCatalog() {
  const { catalog, dirty, unverifiedCount, updateField, toggleUnverified, reset, exportJson } =
    useCatalogStore();
  const [selectedId, setSelectedId] = useState(catalog.profiles[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.profiles.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const selected = catalog.profiles.find((p) => p.id === selectedId);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="space-y-2 border-b border-slate-800 p-3">
          <h1 className="text-sm font-bold text-amber-300">Khârn-Âges — Admin catalogue</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un profil…"
            className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm outline-none ring-1 ring-slate-700 focus:ring-amber-600"
          />
          <div className="flex gap-1.5">
            <button
              onClick={exportJson}
              className="flex-1 rounded bg-amber-600/80 px-2 py-1 text-xs font-medium text-amber-50 hover:bg-amber-600"
            >
              Exporter JSON
            </button>
            <button
              onClick={reset}
              disabled={!dirty}
              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              Réinitialiser
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {filtered.length} profil(s) · {unverifiedCount} champ(s) ⚠
            {dirty && <span className="text-amber-400"> · modifié</span>}
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                  p.id === selectedId ? "bg-amber-600/20 text-amber-100" : "hover:bg-slate-800"
                }`}
              >
                <span>
                  {p.name}
                  {p.level && <span className="ml-1 text-slate-500">{LEVEL_LABEL[p.level]}</span>}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {(p.unverifiedFields?.length ?? 0) > 0 && <span className="text-amber-500">⚠</span>}
                  {p.cost}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {selected ? (
          <div className="mx-auto max-w-2xl">
            <ProfileDetail
              profile={selected}
              cat={catalog}
              updateField={updateField}
              toggleUnverified={toggleUnverified}
            />
          </div>
        ) : (
          <p className="text-slate-500">Sélectionnez un profil.</p>
        )}
      </main>
    </div>
  );
}
