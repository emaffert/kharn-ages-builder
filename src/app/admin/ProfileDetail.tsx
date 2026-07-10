import { useState } from "react";
import { iconFor } from "@core";
import type { Catalog, Constraint, Effect, Level, Model, Profile } from "@core";
import { describeConstraint, describeEffect, explainTraitUsage, specialCardsForProfile } from "@ui/explain";
import type { FieldValue } from "../useCatalogStore";
import { ConstraintListEditor, EffectListEditor } from "../RuleEditors";
import { IconEditor } from "../IconEditor";
import { AddButton, Badge, CheckField, DetailPage, DomainIcon, EditableNumber, Field, FlagButton, RemoveButton, RuleCard, Section } from "./primitives";
import { INPUT, MASTERY_DOMAINS, SECTION, STAT_LABELS, removeAt, replaceAt } from "./shared";
import { EquipmentEditor, LimitationEditor, RulesEditor, SkillsEditor, TraitsEditor } from "./editors";

// ── Détail d'un profil ───────────────────────────────────────────────────────

interface DetailProps {
  profile: Profile;
  cat: Catalog;
  updateField: (id: string, path: string, value: FieldValue) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  updateModel: (id: string, patch: Partial<Model>) => void;
  addModel: (factionId?: string) => string;
  assignProfileToModel: (profileId: string, targetModelId: string) => void;
  setIcon: (cardImage: string, dataUrl: string | null) => void;
  toggleUnverified: (id: string, key: string) => void;
}

const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III" };

/** Emplacement d'icône (partagée ou propre au niveau) : aperçu + boutons éditer/retirer. */
export function IconSlot({
  title,
  hint,
  src,
  active,
  createLabel = "Créer l'icône…",
  onEdit,
  onRemove,
}: {
  title: string;
  hint: string;
  src?: string;
  active: boolean;
  createLabel?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2.5">
      {src ? (
        <img src={src} alt="" className="adm-slot-thumb h-16 w-16" />
      ) : (
        <div className="adm-slot-empty h-16 w-16 text-center text-[10px]">aucune</div>
      )}
      <div className="flex w-40 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="adm-muted text-[11px] font-semibold">{title}</span>
          {active && <span className="adm-slot-on px-1 text-[9px]">affichée</span>}
        </div>
        <p className="adm-faint text-[10px] leading-tight">{hint}</p>
        <div className="mt-auto flex gap-1.5">
          <button onClick={onEdit} className="adm-btn-soft px-2 py-0.5 text-xs">
            {src ? "Modifier…" : createLabel}
          </button>
          {src && (
            <button onClick={onRemove} className="adm-x px-2 py-0.5 text-xs">
              Retirer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfileDetail({ profile, cat, updateField, updateProfile, updateModel, addModel, assignProfileToModel, setIcon, toggleUnverified }: DetailProps) {
  const cards = specialCardsForProfile(profile, cat);
  // Éditeur ouvert et pour quelle cible : "shared" (par carte) ou "own" (propre à ce niveau).
  const [editingIcon, setEditingIcon] = useState<null | "shared" | "own">(null);
  const shared = profile.cardImage ? cat.icons?.[profile.cardImage] : undefined;
  const own = profile.icon; // déroge au partage : l'emporte sur la partagée
  const displayed = iconFor(cat, profile); // ce que voit réellement l'app
  const uv = (key: string) => profile.unverifiedFields?.includes(key) ?? false;
  const upd = (path: string, v: FieldValue) => updateField(profile.id, path, v);
  const patch = (p: Partial<Profile>) => updateProfile(profile.id, p);
  const flag = (key: string) => toggleUnverified(profile.id, key);
  // Un seul indicateur « à vérifier » pour toutes les caractéristiques (fastidieux à retirer 1 par 1).
  const STAT_PATHS = [...STAT_LABELS.map(([k]) => `stats.${k}`), "stature", "pa", "pv"];
  const anyStatUnverified = STAT_PATHS.some(uv);
  const toggleAllStats = () => {
    const target = !anyStatUnverified; // état visé, décidé sur l'état pré-clic → chaque champ basculé au plus une fois
    for (const path of STAT_PATHS) if (uv(path) !== target) flag(path);
  };
  const setArmor = (p: Partial<NonNullable<Profile["armor"]>>) =>
    patch({ armor: { ...(profile.armor ?? {}), ...p } });
  // Modèle = groupe de figurines (ex. « du Sacrifice » = Prêtre + Bourreau). Le nom est partagé.
  const model = profile.modelId != null ? cat.models.find((m) => m.id === profile.modelId) : undefined;
  const siblings = model ? cat.profiles.filter((p) => p.modelId === model.id) : [];
  // Modèles proposés au rattachement : ceux de la même faction (+ le modèle courant), par nom.
  const groupOptions = cat.models
    .filter((m) => (m.factionId ?? null) === (profile.factionId ?? null) || m.id === profile.modelId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const NEW_GROUP = "__new__";
  const onGroupChange = (value: string) => {
    const target = value === NEW_GROUP ? addModel(profile.factionId) : value;
    assignProfileToModel(profile.id, target);
  };
  // Voies maîtrisées (dérivées) : le profil possède la compétence liée à la voie.
  const casterWays = cat.magicWays.filter(
    (w) => w.skillId != null && profile.skills.some((s) => s.skillId === w.skillId),
  );

  // Une contrainte de carte ne concerne ce profil que si son sujet est ce profil
  // (ou si elle n'a pas de sujet précis). Évite que Xayìn hérite des contraintes de Muskh.
  const constraintConcernsProfile = (c: Constraint): boolean => {
    const params = c.params as { subjectProfileId?: string; profileId?: string };
    const subject = params.subjectProfileId ?? params.profileId;
    return subject == null || subject === profile.id;
  };
  const inheritedConstraints: { c: Constraint; via: string }[] = cards.flatMap((card) =>
    card.constraints.filter(constraintConcernsProfile).map((c) => ({ c, via: card.name })),
  );
  const inheritedEffects: { e: Effect; via: string }[] = cards.flatMap((card) =>
    card.effects.map((e) => ({ e, via: card.name })),
  );

  return (
    <DetailPage
      header={
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            value={profile.name}
            onChange={(e) => upd("name", e.target.value)}
            className="adm-title flex-1"
          />
          <label className="flex items-center gap-1 adm-accent">
            <input
              type="number"
              value={profile.cost}
              onChange={(e) => upd("cost", Number(e.target.value))}
              className="adm-cost"
            />
            <span className="text-sm">Ko</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Icône partagée : commune à tous les niveaux qui partagent cette illustration de carte. */}
          <IconSlot
            title="Partagée (par carte)"
            hint="Commune à tous les niveaux de ce modèle."
            src={shared}
            active={shared != null && own == null}
            onEdit={() => setEditingIcon("shared")}
            onRemove={() => setIcon(profile.cardImage, null)}
          />
          {/* Icône propre à ce niveau : déroge au partage (l'emporte sur la partagée). */}
          <IconSlot
            title="Propre à ce niveau"
            hint="Déroge au partage : remplace la partagée pour ce profil seul."
            src={own}
            active={own != null}
            createLabel="Déroger au partage…"
            onEdit={() => setEditingIcon("own")}
            onRemove={() => patch({ icon: undefined })}
          />
        </div>
        {displayed == null && (
          <p className="text-[10px] adm-faint">Aucune icône - l'app affichera le blason + niveau.</p>
        )}
        {editingIcon && (
          <IconEditor
            initialSrc={profile.cardImage ? `/${profile.cardImage}` : undefined}
            onSave={(dataUrl) => {
              if (editingIcon === "own") patch({ icon: dataUrl });
              else setIcon(profile.cardImage, dataUrl);
              setEditingIcon(null);
            }}
            onClose={() => setEditingIcon(null)}
          />
        )}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Field label="Niveau" className="w-20">
            <select
              value={profile.level ?? ""}
              onChange={(e) =>
                patch({ level: e.target.value === "" ? undefined : (Number(e.target.value) as Level) })
              }
              className={INPUT}
            >
              <option value="">-</option>
              <option value="1">I</option>
              <option value="2">II</option>
              <option value="3">III</option>
            </select>
          </Field>
          <Field label="Faction" className="w-32">
            <input
              value={profile.factionId ?? ""}
              onChange={(e) => patch({ factionId: e.target.value || undefined })}
              className={INPUT}
            />
          </Field>
          <CheckField
            label="Personnage"
            checked={profile.isNamed ?? false}
            onChange={(v) => patch({ isNamed: v || undefined })}
          />
          {casterWays.length > 0 && (
            <span
              className="flex items-center gap-1 text-xs adm-accent"
              title="Lanceur dérivé de ses compétences de voie (onglet « Voies de magie »)"
            >
              Mage : {casterWays.map((w) => w.name).join(", ")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <Field label="Groupe (modèle)" className="w-56">
            <select
              value={profile.modelId ?? ""}
              onChange={(e) => onGroupChange(e.target.value)}
              className={INPUT}
              title="Rattache cette figurine à un groupe (regroupe les variantes, ex. les Guerriers)"
            >
              {profile.modelId == null && <option value="">- aucun -</option>}
              {groupOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({cat.profiles.filter((p) => p.modelId === m.id).length})
                </option>
              ))}
              <option value={NEW_GROUP}>＋ Nouveau groupe…</option>
            </select>
          </Field>
          {model && (
            <Field label="Nom du groupe" className="w-48">
              <input
                value={model.name}
                onChange={(e) => updateModel(model.id, { name: e.target.value })}
                className={INPUT}
                title="Renomme le groupe (nom partagé par toutes ses figurines)"
              />
            </Field>
          )}
          {model && siblings.length > 1 && (
            <span className="pb-1 text-xs adm-faint">
              regroupe{" "}
              {siblings
                .map((s) => `${s.name}${s.level != null ? ` (${ROMAN[s.level] ?? s.level})` : ""}`)
                .join(", ")}
            </span>
          )}
        </div>
        <Field label="Limitation">
          <LimitationEditor
            limitation={profile.limitation}
            models={cat.models}
            onChange={(l) => patch({ limitation: l })}
          />
        </Field>
      </header>
      }
      body={
        <>

      <Section title="Caractéristiques (modifiables)">
        <div className="flex items-center gap-2">
          <FlagButton active={anyStatUnverified} onClick={toggleAllStats} />
          <span className="text-xs adm-faint">
            à vérifier - un seul indicateur pour toutes les caractéristiques
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {STAT_LABELS.map(([k, label]) => (
            <EditableNumber
              key={label}
              label={label}
              value={profile.stats[k]}
              unverified={anyStatUnverified}
              onChange={(v) => upd(`stats.${k}`, v)}
            />
          ))}
          <EditableNumber
            label="Stature"
            value={profile.stature}
            unverified={anyStatUnverified}
            onChange={(v) => upd("stature", v ?? 0)}
          />
          <EditableNumber
            label="PA"
            value={profile.pa}
            unverified={anyStatUnverified}
            onChange={(v) => upd("pa", v ?? 0)}
          />
          <EditableNumber
            label="PV"
            value={profile.pv}
            unverified={anyStatUnverified}
            onChange={(v) => upd("pv", v ?? 0)}
          />
        </div>
      </Section>

      <Section title="Armure (protection en cas d'échec / seuil / protection en cas de réussite)">
        {profile.armor ? (
          <div className="flex flex-wrap items-center gap-2">
            <EditableNumber
              label="Prot. échec"
              value={profile.armor.protectionEchec ?? null}
              unverified={uv("armor.protectionEchec")}
              onChange={(v) => setArmor({ protectionEchec: typeof v === "number" ? v : undefined })}
              onToggle={() => flag("armor.protectionEchec")}
            />
            <EditableNumber
              label="Seuil"
              value={profile.armor.seuil ?? null}
              unverified={uv("armor.seuil")}
              onChange={(v) => setArmor({ seuil: typeof v === "number" ? v : undefined })}
              onToggle={() => flag("armor.seuil")}
            />
            <EditableNumber
              label="Prot. réussite"
              value={profile.armor.protectionReussite ?? null}
              unverified={uv("armor.protectionReussite")}
              onChange={(v) => setArmor({ protectionReussite: typeof v === "number" ? v : undefined })}
              onToggle={() => flag("armor.protectionReussite")}
            />
            <EditableNumber
              label="Durabilité"
              value={profile.armor.durability ?? null}
              unverified={uv("armor.durability")}
              onChange={(v) => setArmor({ durability: typeof v === "number" ? v : undefined })}
              onToggle={() => flag("armor.durability")}
            />
            <RemoveButton onClick={() => patch({ armor: undefined })} />
          </div>
        ) : (
          <AddButton onClick={() => patch({ armor: {} })}>Ajouter une armure</AddButton>
        )}
      </Section>

      <Section title="Dés de maîtrise (chaque dé porte 1 à 5 domaines)">
        <div className="group space-y-2">
          {profile.masteryDice.map((die, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="w-10 text-xs font-semibold adm-muted">Dé {i + 1}</span>
              {MASTERY_DOMAINS.map((dom) => {
                const on = die.includes(dom);
                return (
                  <button
                    key={dom}
                    type="button"
                    title={dom}
                    aria-label={dom}
                    onClick={() =>
                      patch({
                        masteryDice: replaceAt(
                          profile.masteryDice,
                          i,
                          on ? die.filter((x) => x !== dom) : [...die, dom],
                        ),
                      })
                    }
                    className={on ? "adm-dice adm-dice--on" : "adm-dice"}
                  >
                    <DomainIcon domain={dom} className="h-5 w-5" />
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

      <Section title="Traits (tags internes - non imprimés sur les cartes)">
        <TraitsEditor traits={profile.traits} onChange={(t) => patch({ traits: t })} />
        <div className="space-y-1 text-xs">
          {profile.traits.map((t) => {
            const usages = explainTraitUsage(t, cat);
            return (
              <div key={t}>
                <span className="font-semibold adm-muted">{t}</span>
                {usages.length === 0 ? (
                  <span className="adm-faint"> - tag interne, non référencé par une règle</span>
                ) : (
                  <ul className="ml-4 list-disc adm-faint">
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
        </>
      }
      verbatim={
        <Section title={SECTION.verbatim}>
          <RulesEditor rules={profile.rules} onChange={(r) => patch({ rules: r })} />
        </Section>
      }
      notes={
        <Section title={SECTION.notes}>
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
      }
      constraints={
        <>
      <Section title={SECTION.constraints}>
        <ConstraintListEditor
          constraints={profile.recruitment}
          cat={cat}
          onChange={(c) => patch({ recruitment: c })}
          onProfile
        />
      </Section>

      {inheritedConstraints.length > 0 && (
        <Section title={`${SECTION.constraints} héritées des cartes (lecture seule)`}>
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
        </>
      }
      effects={
        <>
      <Section title={SECTION.effects}>
        <EffectListEditor
          effects={profile.effects ?? []}
          newSource={{ kind: "profile", id: profile.id }}
          cat={cat}
          onChange={(e) => patch({ effects: e.length ? e : undefined })}
        />
      </Section>

      {inheritedEffects.length > 0 && (
        <Section title={`${SECTION.effects} hérités des cartes (lecture seule)`}>
          <div className="space-y-2">
            {inheritedEffects.map(({ e, via }, idx) => (
              <RuleCard
                key={`${e.id}-${idx}`}
                human={describeEffect(e, cat)}
                sourceText={e.sourceText}
                badges={
                  <>
                    <Badge>{e.operation.kind}</Badge>
                    <Badge tone="violet">via « {via} »</Badge>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}
        </>
      }
    />
  );
}

