import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Catalog, Constraint, Effect, Level, Limitation, Profile, RuleText, SkillRef } from "@core";
import { describeConstraint, describeEffect, explainTraitUsage, specialCardsForProfile } from "@ui/explain";
import { useCatalogStore, type FieldValue } from "./useCatalogStore";
import { ConstraintListEditor, EffectListEditor } from "./RuleEditors";

const STAT_LABELS: [keyof Profile["stats"], string][] = [
  ["v", "V"],
  ["p", "P"],
  ["a", "A"],
  ["c", "C"],
  ["t", "T"],
  ["i", "I"],
];

const LEVEL_LABEL = ["", "I", "II", "III"];

const MASTERY_DOMAINS = ["offensive", "defensive", "objectif", "tir", "esoterique"] as const;

const INPUT = "rounded bg-slate-800 px-2 py-1 text-sm outline-none ring-1 ring-slate-700 focus:ring-amber-600";

const replaceAt = <T,>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));
const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);

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

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-dashed border-slate-600 px-2 py-1 text-xs text-slate-400 hover:border-amber-600 hover:text-amber-300"
    >
      {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Supprimer"
      className="text-slate-500 hover:text-red-400"
    >
      ✕
    </button>
  );
}

function FlagButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Lecture incertaine (cliquer pour valider)" : "Marquer comme « à vérifier »"}
      className={`leading-none transition-opacity ${
        active ? "text-amber-400" : "text-slate-500 opacity-0 group-hover:opacity-100"
      }`}
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
      className={`group flex items-center gap-1 rounded px-2 py-1 ${
        unverified ? "bg-amber-950/40 ring-1 ring-amber-600/60" : "bg-slate-800"
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide text-amber-200/90">{label}</span>
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

// ── Éditeurs de champs complexes ─────────────────────────────────────────────

function RulesEditor({ rules, onChange }: { rules: RuleText[]; onChange: (r: RuleText[]) => void }) {
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            placeholder="Label (optionnel)"
            value={r.label ?? ""}
            onChange={(e) => onChange(replaceAt(rules, i, { ...r, label: e.target.value || undefined }))}
            className={`${INPUT} w-32 shrink-0`}
          />
          <textarea
            value={r.text}
            rows={2}
            onChange={(e) => onChange(replaceAt(rules, i, { ...r, text: e.target.value }))}
            className={`${INPUT} flex-1`}
          />
          <RemoveButton onClick={() => onChange(removeAt(rules, i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...rules, { text: "" }])}>+ règle</AddButton>
    </div>
  );
}

function SkillsEditor({
  skills,
  cat,
  onChange,
}: {
  skills: SkillRef[];
  cat: Catalog;
  onChange: (s: SkillRef[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {skills.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={s.skillId}
            onChange={(e) => onChange(replaceAt(skills, i, { ...s, skillId: e.target.value }))}
            className={`${INPUT} flex-1`}
          >
            {cat.skills.map((sk) => (
              <option key={sk.id} value={sk.id}>
                {sk.keyword}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="val"
            value={s.value ?? ""}
            onChange={(e) =>
              onChange(
                replaceAt(skills, i, {
                  ...s,
                  value: e.target.value === "" ? undefined : Number(e.target.value),
                }),
              )
            }
            className={`${INPUT} w-16`}
          />
          <RemoveButton onClick={() => onChange(removeAt(skills, i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...skills, { skillId: cat.skills[0]?.id ?? "" }])}>
        + compétence
      </AddButton>
    </div>
  );
}

function TraitsEditor({ traits, onChange }: { traits: string[]; onChange: (t: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {traits.map((t, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5">
          <input
            value={t}
            onChange={(e) => onChange(replaceAt(traits, i, e.target.value))}
            className="w-28 bg-transparent text-xs text-slate-100 outline-none"
          />
          <RemoveButton onClick={() => onChange(removeAt(traits, i))} />
        </span>
      ))}
      <AddButton onClick={() => onChange([...traits, "nouveau-trait"])}>+ trait</AddButton>
    </div>
  );
}

function EquipmentEditor({
  ids,
  cat,
  onChange,
}: {
  ids: string[];
  cat: Catalog;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {ids.map((id, i) => {
        const e = cat.equipment.find((x) => x.id === id);
        return (
          <div key={i} className="flex items-center gap-2">
            <select
              value={id}
              onChange={(ev) => onChange(replaceAt(ids, i, ev.target.value))}
              className={`${INPUT} flex-1`}
            >
              {cat.equipment.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <span className="w-16 text-right text-xs text-slate-400">{e ? `${e.cost} Ko` : "?"}</span>
            <RemoveButton onClick={() => onChange(removeAt(ids, i))} />
          </div>
        );
      })}
      <AddButton onClick={() => onChange([...ids, cat.equipment[0]?.id ?? ""])}>
        + équipement
      </AddButton>
    </div>
  );
}

function LimitationEditor({
  limitation,
  onChange,
}: {
  limitation: Limitation;
  onChange: (l: Limitation) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={limitation.kind}
        onChange={(e) => onChange({ ...limitation, kind: e.target.value as Limitation["kind"] })}
        className={INPUT}
      >
        <option value="X">X (multiple)</option>
        <option value="U">U (unique)</option>
        <option value="P">P (personnage)</option>
        <option value="special">special</option>
      </select>
      {limitation.kind === "X" && (
        <input
          type="number"
          value={limitation.value ?? ""}
          onChange={(e) =>
            onChange({ ...limitation, value: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className={`${INPUT} w-16`}
          placeholder="X"
        />
      )}
    </div>
  );
}

// ── Détail d'un profil ───────────────────────────────────────────────────────

interface DetailProps {
  profile: Profile;
  cat: Catalog;
  updateField: (id: string, path: string, value: FieldValue) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  toggleUnverified: (id: string, key: string) => void;
  onZoom: (src: string) => void;
}

function ProfileDetail({ profile, cat, updateField, updateProfile, toggleUnverified, onZoom }: DetailProps) {
  const cards = specialCardsForProfile(profile, cat);
  const uv = (key: string) => profile.unverifiedFields?.includes(key) ?? false;
  const upd = (path: string, v: FieldValue) => updateField(profile.id, path, v);
  const patch = (p: Partial<Profile>) => updateProfile(profile.id, p);
  const flag = (key: string) => toggleUnverified(profile.id, key);

  const inheritedConstraints: { c: Constraint; via: string }[] = cards.flatMap((card) =>
    card.constraints.map((c) => ({ c, via: card.name })),
  );
  const inheritedEffects: { e: Effect; via: string }[] = cards.flatMap((card) =>
    card.effects.map((e) => ({ e, via: card.name })),
  );

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
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-xs text-slate-400">Niveau</span>
            <select
              value={profile.level ?? ""}
              onChange={(e) =>
                patch({ level: e.target.value === "" ? undefined : (Number(e.target.value) as Level) })
              }
              className={INPUT}
            >
              <option value="">—</option>
              <option value="1">I</option>
              <option value="2">II</option>
              <option value="3">III</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs text-slate-400">Faction</span>
            <input
              value={profile.factionId ?? ""}
              onChange={(e) => patch({ factionId: e.target.value || undefined })}
              className={`${INPUT} w-28`}
            />
          </label>
          <LimitationEditor limitation={profile.limitation} onChange={(l) => patch({ limitation: l })} />
          <label className="flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={profile.isNamed ?? false}
              onChange={(e) => patch({ isNamed: e.target.checked || undefined })}
            />
            Personnage
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={profile.magic?.canCast ?? false}
              onChange={(e) =>
                patch({
                  magic: e.target.checked
                    ? { canCast: true, magicWayIds: profile.magic?.magicWayIds ?? [] }
                    : undefined,
                })
              }
            />
            Mage
          </label>
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

      <Section title="Dés de maîtrise (chaque dé porte 1 à 5 domaines)">
        <div className="group space-y-1.5">
          {profile.masteryDice.map((die, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="w-10 text-xs text-slate-500">dé {i + 1}</span>
              {MASTERY_DOMAINS.map((dom) => {
                const on = die.includes(dom);
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() =>
                      patch({
                        masteryDice: replaceAt(
                          profile.masteryDice,
                          i,
                          on ? die.filter((x) => x !== dom) : [...die, dom],
                        ),
                      })
                    }
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      on
                        ? "bg-amber-600/40 text-amber-100 ring-1 ring-amber-600/60"
                        : "bg-slate-800 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {dom}
                  </button>
                );
              })}
              <RemoveButton onClick={() => patch({ masteryDice: removeAt(profile.masteryDice, i) })} />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <AddButton onClick={() => patch({ masteryDice: [...profile.masteryDice, []] })}>
              + dé
            </AddButton>
            <FlagButton active={uv("masteryDice")} onClick={() => flag("masteryDice")} />
          </div>
        </div>
      </Section>

      <Section title="Compétences">
        <SkillsEditor skills={profile.skills} cat={cat} onChange={(s) => patch({ skills: s })} />
      </Section>

      <Section title="Traits (tags internes — non imprimés sur les cartes)">
        <TraitsEditor traits={profile.traits} onChange={(t) => patch({ traits: t })} />
        <div className="space-y-1 text-xs">
          {profile.traits.map((t) => {
            const usages = explainTraitUsage(t, cat);
            return (
              <div key={t}>
                <span className="font-semibold text-slate-300">{t}</span>
                {usages.length === 0 ? (
                  <span className="text-slate-500"> — tag interne, non référencé par une règle</span>
                ) : (
                  <ul className="ml-4 list-disc text-slate-400">
                    {usages.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Équipement de base">
        <EquipmentEditor
          ids={profile.baseEquipmentIds}
          cat={cat}
          onChange={(ids) => patch({ baseEquipmentIds: ids })}
        />
      </Section>

      <Section title="Règles de la carte (verbatim — fait foi)">
        <RulesEditor rules={profile.rules} onChange={(r) => patch({ rules: r })} />
      </Section>

      <Section title="Notes (hors carte — non verbatim)">
        <div className="space-y-2">
          {(profile.notes ?? []).map((n, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={n}
                rows={2}
                onChange={(e) => patch({ notes: replaceAt(profile.notes ?? [], i, e.target.value) })}
                className={`${INPUT} flex-1`}
              />
              <RemoveButton
                onClick={() => {
                  const next = removeAt(profile.notes ?? [], i);
                  patch({ notes: next.length ? next : undefined });
                }}
              />
            </div>
          ))}
          <AddButton onClick={() => patch({ notes: [...(profile.notes ?? []), ""] })}>+ note</AddButton>
        </div>
      </Section>

      <Section title="Contraintes du profil (modifiables)">
        <ConstraintListEditor
          constraints={profile.recruitment}
          cat={cat}
          onChange={(c) => patch({ recruitment: c })}
        />
      </Section>

      {inheritedConstraints.length > 0 && (
        <Section title="Contraintes héritées des cartes spéciales (lecture seule)">
          <div className="space-y-2">
            {inheritedConstraints.map(({ c, via }, idx) => (
              <RuleCard
                key={`${c.id}-${idx}`}
                human={describeConstraint(c, cat)}
                sourceText={c.sourceText}
                badges={
                  <>
                    <Badge tone={c.severity === "error" ? "red" : "amber"}>{c.severity}</Badge>
                    <Badge>{c.type}</Badge>
                    <Badge tone="violet">via « {via} »</Badge>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Effets / octrois du profil (modifiables)">
        <EffectListEditor
          effects={profile.effects ?? []}
          profileId={profile.id}
          cat={cat}
          onChange={(e) => patch({ effects: e.length ? e : undefined })}
        />
      </Section>

      {inheritedEffects.length > 0 && (
        <Section title="Effets hérités des cartes spéciales (lecture seule)">
          <div className="space-y-2">
            {inheritedEffects.map(({ e, via }, idx) => (
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
                    <Badge tone="violet">via « {via} »</Badge>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      {import.meta.env.DEV && (
        <Section title="Carte (aperçu — dev uniquement)">
          <img
            src={`/${profile.cardImage}`}
            alt={`Carte de ${profile.name}`}
            loading="lazy"
            title="Cliquer pour agrandir"
            onClick={() => onZoom(`/${profile.cardImage}`)}
            className="max-h-[460px] w-auto cursor-zoom-in rounded border border-slate-700"
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
  const store = useCatalogStore();
  const { catalog } = store;
  const [selectedId, setSelectedId] = useState(catalog.profiles[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = store.importJson(await file.text());
    if (err) alert(`Import impossible : ${err}`);
  };

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
              onClick={store.exportJson}
              className="flex-1 rounded bg-amber-600/80 px-2 py-1 text-xs font-medium text-amber-50 hover:bg-amber-600"
            >
              Exporter JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
            >
              Importer
            </button>
            <button
              onClick={store.reset}
              disabled={!store.dirty}
              className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-40"
            >
              Réinitialiser
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              className="hidden"
            />
          </div>
          <p className="text-xs text-slate-500">
            {filtered.length} profil(s) · {store.unverifiedCount} champ(s) ⚠
            {store.dirty && <span className="text-amber-400"> · modifié</span>}
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
              updateField={store.updateField}
              updateProfile={store.updateProfile}
              toggleUnverified={store.toggleUnverified}
              onZoom={setZoom}
            />
          </div>
        ) : (
          <p className="text-slate-500">Sélectionnez un profil.</p>
        )}
      </main>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          <img src={zoom} alt="Carte agrandie" className="max-h-[95vh] max-w-[95vw] rounded shadow-2xl" />
        </div>
      )}
    </div>
  );
}
