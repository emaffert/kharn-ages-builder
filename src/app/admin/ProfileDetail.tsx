import { useState } from "react";
import { iconFor } from "@core";
import type { Catalog, Constraint, Effect, Level, Profile } from "@core";
import { Button, Dialog } from "@ui";
import { describeConstraint, describeEffect, explainTraitUsage, specialCardsForProfile } from "@ui/explain";
import { iconSrc } from "../../lib/icons";
import type { FieldValue } from "../useCatalogStore";
import { ConstraintListEditor, EffectListEditor } from "../RuleEditors";
import { IconEditor } from "../IconEditor";
import { AddButton, Badge, CardImageSection, ChipMultiSelect, DetailHeader, DetailPage, DomainIcon, EditableNumber, Field, FieldGroup, FlagButton, IdField, NotesSection, RemoveButton, RuleCard, Section } from "./primitives";
import { INPUT, LEVEL_LABEL, MASTERY_DOMAINS, SECTION, STATS_COMBAT, STATS_SECONDARY, STAT_LABELS, removeAt, replaceAt } from "./shared";
import { EquipmentEditor, LimitationEditor, RulesEditor, SkillsEditor, TraitsEditor } from "./editors";
import { ConstraintsHelp, EffectsHelp, IdentityHelp, TraitsHelp } from "./help/ProfileHelp";

// ── Détail d'un profil ───────────────────────────────────────────────────────

interface DetailProps {
  profile: Profile;
  cat: Catalog;
  updateField: (id: string, path: string, value: FieldValue) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  renameModel: (id: string, name: string) => string;
  addModel: (factionId?: string, name?: string) => string;
  assignProfileToModel: (profileId: string, targetModelId: string) => void;
  setIcon: (cardImage: string, dataUrl: string | null) => void;
  toggleUnverified: (id: string, key: string) => void;
  /** Renomme l'identifiant du profil, en cascade sur tout ce qui le cite. */
  onRenameId: (newId: string) => void;
  /** Donne un identifiant lisible à une entité qui porte encore celui de sa création. */
  onSlugifyId?: () => void;
  /** Supprime le profil, après confirmation, avec tout ce qui le cite. */
  onRemove: () => void;
}

const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III" };

/** Emplacement d'icône (partagée ou propre au niveau) : aperçu + boutons éditer/retirer. */
export function IconSlot({
  title,
  hint,
  src,
  active,
  createLabel = "Créer l'icône…",
  disabledReason,
  onEdit,
  onRemove,
}: {
  title: string;
  hint: string;
  src?: string;
  active: boolean;
  createLabel?: string;
  /** Non vide = emplacement inutilisable, et pourquoi (remplace l'explication habituelle). */
  disabledReason?: string;
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
        <p className="adm-faint text-[10px] leading-tight">{disabledReason ?? hint}</p>
        <div className="mt-auto flex gap-1.5">
          <button
            onClick={onEdit}
            disabled={disabledReason != null}
            className="adm-btn-soft px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
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

/** Marques « non retirable » restreintes à l'équipement de base encore présent. */
function keepFixed(fixed: string[] | undefined, baseIds: string[]): string[] | undefined {
  const kept = (fixed ?? []).filter((id) => baseIds.includes(id));
  return kept.length ? kept : undefined;
}

/** Quantités restreintes à l'équipement de base encore présent. */
function keepCounts(
  counts: Record<string, number> | undefined,
  baseIds: string[],
): Record<string, number> | undefined {
  const kept = Object.fromEntries(Object.entries(counts ?? {}).filter(([id]) => baseIds.includes(id)));
  return Object.keys(kept).length ? kept : undefined;
}

/**
 * Saisie du nom d'un groupe de figurines, à la création comme au renommage.
 *
 * Le nom n'est pas une étiquette libre : deux groupes d'une même faction qui le partagent n'en font
 * qu'un. C'est ainsi qu'on réunit les niveaux d'une même figurine, mais c'est aussi irréversible en
 * un clic - d'où l'avertissement, affiché pendant la frappe et non après coup.
 */
function GroupNameDialog({
  mode,
  name,
  onName,
  twinName,
  factionName,
  onClose,
  onSubmit,
}: {
  mode: null | "create" | "rename";
  name: string;
  onName: (v: string) => void;
  /** Nom du groupe existant que la validation rejoindrait, s'il y en a un. */
  twinName?: string;
  factionName: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const creating = mode === "create";
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={creating ? "Nouveau groupe de figurines" : "Renommer le groupe"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={name.trim() === ""}>
            {creating ? "Créer" : "Renommer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <label className="ui-field">
          <span className="ui-field__label">Nom du groupe</span>
          <input
            className="ui-input"
            value={name}
            autoFocus
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
            placeholder="ex. Guerrier"
          />
        </label>
        <p className="adm-faint text-xs">
          Le groupe réunit les niveaux et variantes d'une même figurine. Son nom est celui que voient
          les joueurs dans la liste de recrutement de {factionName}.
        </p>
        {twinName && (
          <p className="ui-warn text-xs">
            « {twinName} » existe déjà dans cette faction : cette figurine le rejoindra, au lieu de
            former un groupe à part.
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function ProfileDetail({ profile, cat, updateField, updateProfile, renameModel, addModel, assignProfileToModel, setIcon, toggleUnverified, onRenameId, onSlugifyId, onRemove }: DetailProps) {
  const cards = specialCardsForProfile(profile, cat);
  // Éditeur ouvert et pour quelle cible : "shared" (par carte) ou "own" (propre à ce niveau).
  const [editingIcon, setEditingIcon] = useState<null | "shared" | "own">(null);
  // Le nom du groupe se saisit dans une boîte de dialogue, à la création comme au renommage : c'est
  // lui qui décide de la fusion avec un groupe existant, et la dialogue l'annonce avant de valider.
  const [groupDialog, setGroupDialog] = useState<null | "create" | "rename">(null);
  const [groupName, setGroupName] = useState("");
  // Références (`<hash>.webp`), pas des images : `iconSrc` les résout pour l'affichage.
  const shared = profile.cardImage ? cat.icons?.[profile.cardImage] : undefined;
  const own = profile.icon; // déroge au partage : l'emporte sur la partagée
  const displayed = iconFor(cat, profile); // ce que voit réellement l'app
  // Origine : soit un peuple fixe, soit « choisie au recrutement » - le mode se lit sur la donnée
  // (`originChoices` renseigné), sans état local qui survivrait au passage à un autre profil.
  const CHOIX = "__au-recrutement__";
  const autresPeuples = cat.factions.filter((f) => f.id !== profile.factionId).map((f) => f.id);
  const auChoix = (profile.originChoices?.length ?? 0) > 0;
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
  const openGroupDialog = (mode: "create" | "rename") => {
    setGroupName(mode === "rename" ? (model?.name ?? "") : "");
    setGroupDialog(mode);
  };
  const onGroupChange = (value: string) => {
    if (value === NEW_GROUP) openGroupDialog("create");
    else assignProfileToModel(profile.id, value);
  };
  /**
   * Groupe de la même faction portant déjà le nom en cours de saisie : valider l'y réunira. Le
   * groupe courant ne compte que pour une création - le renommer en son propre nom ne fusionne rien.
   */
  const groupTwin = (() => {
    const key = groupName.trim().toLowerCase();
    if (!key) return undefined;
    return cat.models.find(
      (m) =>
        !(groupDialog === "rename" && m.id === model?.id) &&
        (m.factionId ?? null) === (profile.factionId ?? null) &&
        m.name.trim().toLowerCase() === key,
    );
  })();
  const submitGroupDialog = () => {
    const name = groupName.trim();
    if (!name) return;
    if (groupDialog === "rename" && model) renameModel(model.id, name);
    // Créer un groupe qui existe déjà revient à rejoindre celui-ci - inutile d'en faire un jumeau
    // pour le fusionner dans la foulée.
    else assignProfileToModel(profile.id, groupTwin?.id ?? addModel(profile.factionId, name));
    setGroupDialog(null);
  };
  // Voies maîtrisées (dérivées) : le profil possède la compétence liée à la voie.
  const casterWays = cat.magicWays.filter(
    (w) => w.skillId != null && profile.skills.some((s) => s.skillId === w.skillId),
  );
  const factionName = cat.factions.find((f) => f.id === profile.factionId)?.name ?? "Sans faction";

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
        <DetailHeader
          name={profile.name}
          onName={(v) => upd("name", v)}
          onNameCommit={onSlugifyId}
          cost={profile.cost}
          onCost={(v) => upd("cost", v ?? 0)}
          onRemove={onRemove}
          removeTitle="Supprimer ce profil"
          sub={
            <>
              <IdField cat={cat} kind="profile" id={profile.id} onRename={onRenameId} />
              <span className="dot" />
              <span>
                {factionName}
                {profile.level != null && ` · Niveau ${LEVEL_LABEL[profile.level]}`}
              </span>
              {model && (
                <>
                  <span className="dot" />
                  <span>Groupe « {model.name} »</span>
                </>
              )}
              {casterWays.length > 0 && (
                <>
                  <span className="dot" />
                  <span className="adm-accent" title="Lanceur dérivé de ses compétences de voie">
                    Mage : {casterWays.map((w) => w.name).join(", ")}
                  </span>
                </>
              )}
            </>
          }
        />
      }
      body={
        <>
          <Section title="Identité" icon="identity" meta={<IdentityHelp />}>
            <div className="flex flex-col gap-4">
              {/* Icônes : partagée (par carte) et propre au niveau (déroge au partage). */}
              <div className="flex flex-wrap gap-4">
                <IconSlot
                  title="Partagée (par carte)"
                  hint="Commune à tous les niveaux de ce modèle."
                  src={iconSrc(shared)}
                  active={shared != null && own == null}
                  /* Le partage se fait par image de carte : sans elle, il n'y a rien à partager
                     - et toutes les fiches sans carte se retrouveraient avec la même icône. */
                  disabledReason={
                    profile.cardImage
                      ? undefined
                      : "Renseignez d'abord l'image de carte, en bas de la fiche."
                  }
                  onEdit={() => setEditingIcon("shared")}
                  onRemove={() => setIcon(profile.cardImage, null)}
                />
                <IconSlot
                  title="Propre à ce niveau"
                  hint="Déroge au partage : remplace la partagée pour ce profil seul."
                  src={iconSrc(own)}
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
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <Field
                  label="Groupe de figurines"
                  hint="regroupe les niveaux et variantes d'une même figurine"
                  className="w-56"
                >
                  <select value={profile.modelId ?? ""} onChange={(e) => onGroupChange(e.target.value)} className={INPUT}>
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
                  <button
                    onClick={() => openGroupDialog("rename")}
                    className="adm-btn-soft mb-0.5 px-2 py-1 text-xs"
                    title="Change le nom du groupe pour toutes ses figurines"
                  >
                    Renommer le groupe…
                  </button>
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
              <GroupNameDialog
                mode={groupDialog}
                name={groupName}
                onName={setGroupName}
                twinName={groupTwin?.name}
                factionName={factionName}
                onClose={() => setGroupDialog(null)}
                onSubmit={submitGroupDialog}
              />
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
                <Field label="Faction" className="w-40">
                  <select
                    value={profile.factionId ?? ""}
                    onChange={(e) => patch({ factionId: e.target.value || undefined })}
                    className={INPUT}
                  >
                    {cat.factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {/* Origine : ne concerne que les transfuges (Guilde Noire, Affranchis). Vide = la
                    figurine est du peuple de sa faction, ce qui est le cas général. */}
                <Field label="Peuple d’origine" className="w-52">
                  <select
                    value={auChoix ? CHOIX : (profile.origin ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CHOIX) patch({ origin: undefined, originChoices: autresPeuples });
                      else patch({ origin: v || undefined, originChoices: undefined });
                    }}
                    className={INPUT}
                    title="Peuple quitté par la figurine : lui laisse la monture et la nature de ce peuple, pas ses objets ni ses sorts réservés."
                  >
                    <option value="">— sa faction —</option>
                    {cat.factions
                      .filter((f) => f.id !== profile.factionId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    <option value={CHOIX}>— choisie au recrutement —</option>
                  </select>
                </Field>
                {/* Socle : imprimé à droite de la limitation sur les cartes qui le donnent. Ne sert
                    qu'à la figurine physique, aucune règle ne le lit. */}
                <Field label="Socle" className="w-28">
                  <select
                    value={profile.baseSize ?? ""}
                    onChange={(e) =>
                      patch({
                        baseSize: e.target.value
                          ? (Number(e.target.value) as Profile["baseSize"])
                          : undefined,
                      })
                    }
                    className={INPUT}
                    title="Diamètre du socle en mm, tel qu'imprimé sur la carte. Laisser vide si la carte ne le donne pas."
                  >
                    <option value="">—</option>
                    <option value="30">30 mm</option>
                    <option value="40">40 mm</option>
                    <option value="50">50 mm</option>
                    <option value="60">60 mm</option>
                  </select>
                </Field>
              </div>
              {/* N'apparaît que si l'origine est laissée au joueur (l'Agent sombre, seul cas à ce
                  jour) : partout ailleurs, ce bloc n'aurait rien à dire. */}
              {auChoix && (
                <FieldGroup
                  label="Peuples proposés"
                  hint="La question est posée au joueur à chaque recrutement. Tout décocher revient à une origine fixe."
                >
                  <ChipMultiSelect
                    options={autresPeuples.map((id) => ({
                      value: id,
                      label: cat.factions.find((f) => f.id === id)?.name ?? id,
                    }))}
                    selected={profile.originChoices ?? []}
                    onToggle={(id) => {
                      const cur = profile.originChoices ?? [];
                      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                      patch({ originChoices: next.length ? next : undefined });
                    }}
                  />
                </FieldGroup>
              )}
              <Field label="Limitation">
                <LimitationEditor
                  limitation={profile.limitation}
                  models={cat.models}
                  onChange={(l) => patch({ limitation: l })}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Caractéristiques"
            icon="stats"
            meta={
              <span className="flex items-center gap-1.5">
                <FlagButton active={anyStatUnverified} onClick={toggleAllStats} />
                <span className="text-[11px] adm-faint">à vérifier (groupé)</span>
              </span>
            }
          >
            {/* Groupées comme sur la carte : combat (V P A C) · mentales (T I) · dérivées (PA PV Stature). */}
            <div className="flex flex-wrap items-stretch gap-x-4 gap-y-2">
              <div className="flex flex-wrap gap-2">
                {STATS_COMBAT.map(([k, label]) => (
                  <EditableNumber
                    key={label}
                    label={label}
                    value={profile.stats[k]}
                    unverified={anyStatUnverified}
                    onChange={(v) => upd(`stats.${k}`, v)}
                  />
                ))}
              </div>
              <span className="w-px border-l adm-bd-soft" aria-hidden />
              <div className="flex flex-wrap gap-2">
                {STATS_SECONDARY.map(([k, label]) => (
                  <EditableNumber
                    key={label}
                    label={label}
                    value={profile.stats[k]}
                    unverified={anyStatUnverified}
                    onChange={(v) => upd(`stats.${k}`, v)}
                  />
                ))}
              </div>
              <span className="w-px border-l adm-bd-soft" aria-hidden />
              <div className="flex flex-wrap gap-2">
                <EditableNumber label="PA" value={profile.pa} unverified={anyStatUnverified} onChange={(v) => upd("pa", v ?? 0)} />
                <EditableNumber label="PV" value={profile.pv} unverified={anyStatUnverified} onChange={(v) => upd("pv", v ?? 0)} />
                <EditableNumber label="Stature" value={profile.stature} unverified={anyStatUnverified} onChange={(v) => upd("stature", v ?? 0)} />
              </div>
            </div>
          </Section>

          <Section title="Compétences" icon="skills">
            <SkillsEditor skills={profile.skills} cat={cat} onChange={(s) => patch({ skills: s })} />
          </Section>

          <Section title={SECTION.verbatim} icon="verbatim">
            <RulesEditor rules={profile.rules} onChange={(r) => patch({ rules: r })} />
          </Section>

          <Section title="Dés de maîtrise" icon="dice">
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
                <AddButton onClick={() => patch({ masteryDice: [...profile.masteryDice, []] })}>+ dé</AddButton>
                <FlagButton active={uv("masteryDice")} onClick={() => flag("masteryDice")} />
              </div>
            </div>
          </Section>

          {/* Une armure se lit d'un bloc sur la carte (« -1 / 7 / -2 » + durabilité) : un seul
              indicateur « à vérifier » pour les quatre valeurs, comme pour les caractéristiques. */}
          <Section
            title="Armure innée"
            icon="armor"
            meta={
              profile.armor ? (
                <span className="flex items-center gap-1.5">
                  <FlagButton active={uv("armor")} onClick={() => flag("armor")} />
                  <span className="text-[11px] adm-faint">à vérifier</span>
                </span>
              ) : undefined
            }
          >
            {profile.armor ? (
              <div className="flex flex-wrap items-center gap-2">
                <EditableNumber
                  label="Prot. échec"
                  value={profile.armor.protectionEchec ?? null}
                  unverified={uv("armor")}
                  onChange={(v) => setArmor({ protectionEchec: typeof v === "number" ? v : undefined })}
                />
                <EditableNumber
                  label="Seuil"
                  value={profile.armor.seuil ?? null}
                  unverified={uv("armor")}
                  onChange={(v) => setArmor({ seuil: typeof v === "number" ? v : undefined })}
                />
                <EditableNumber
                  label="Prot. réussite"
                  value={profile.armor.protectionReussite ?? null}
                  unverified={uv("armor")}
                  onChange={(v) => setArmor({ protectionReussite: typeof v === "number" ? v : undefined })}
                />
                <EditableNumber
                  label="Durabilité"
                  value={profile.armor.durability ?? null}
                  unverified={uv("armor")}
                  onChange={(v) => setArmor({ durability: typeof v === "number" ? v : undefined })}
                />
                <RemoveButton onClick={() => patch({ armor: undefined })} />
              </div>
            ) : (
              <AddButton onClick={() => patch({ armor: {} })}>Ajouter une armure</AddButton>
            )}
          </Section>

          <Section title="Équipement de base" icon="equipment">
            <EquipmentEditor
              ids={profile.baseEquipmentIds}
              cat={cat}
              onChange={(ids) =>
                // Un équipement retiré de la liste n'a plus ni marque « non retirable » ni quantité.
                patch({
                  baseEquipmentIds: ids,
                  fixedBaseEquipmentIds: keepFixed(profile.fixedBaseEquipmentIds, ids),
                  baseEquipmentCounts: keepCounts(profile.baseEquipmentCounts, ids),
                })
              }
              counts={profile.baseEquipmentCounts}
              onCount={(id, qty) => {
                const next = { ...profile.baseEquipmentCounts, [id]: qty };
                if (qty <= 1) delete next[id];
                patch({ baseEquipmentCounts: Object.keys(next).length ? next : undefined });
              }}
              fixedIds={profile.fixedBaseEquipmentIds}
              onToggleFixed={(id) => {
                const cur = profile.fixedBaseEquipmentIds ?? [];
                const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                patch({ fixedBaseEquipmentIds: next.length ? next : undefined });
              }}
            />
            <div className="mt-2">
              <FlagButton active={uv("baseEquipmentIds")} onClick={() => flag("baseEquipmentIds")} />
            </div>
          </Section>

          <Section title="Traits" icon="traits" note="tags internes, non imprimés sur les cartes" meta={<TraitsHelp />}>
            <TraitsEditor traits={profile.traits} onChange={(t) => patch({ traits: t })} />
            <div className="mt-2 space-y-1 text-xs">
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

          <NotesSection notes={profile.notes ?? []} onChange={(v) => patch({ notes: v })} />

          <Section title={SECTION.effects} icon="effects" id="sec-effects" meta={<EffectsHelp />}>
            <EffectListEditor
              effects={profile.effects ?? []}
              newSource={{ kind: "profile", id: profile.id }}
              cat={cat}
              onChange={(e) => patch({ effects: e.length ? e : undefined })}
            />
          </Section>

          {inheritedEffects.length > 0 && (
            <Section title="Effets hérités" icon="effects" id="sec-effects-inherited" note="octrois des cartes (lecture seule)">
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

          <Section title={SECTION.constraints} icon="constraints" id="sec-constraints" meta={<ConstraintsHelp />}>
            <ConstraintListEditor
              constraints={profile.recruitment}
              cat={cat}
              onChange={(c) => patch({ recruitment: c })}
              onProfile
            />
          </Section>

          {inheritedConstraints.length > 0 && (
            <Section title="Contraintes héritées" icon="constraints" id="sec-constraints-inherited" note="des cartes (lecture seule)">
              <div className="space-y-2">
                {inheritedConstraints.map(({ c, via }, idx) => (
                  <RuleCard
                    key={`${c.id}-${idx}`}
                    human={describeConstraint(c, cat)}
                    sourceText={c.sourceText}
                    badges={
                      <>
                        <Badge>{c.type}</Badge>
                        <Badge tone="violet">via « {via} »</Badge>
                      </>
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          <CardImageSection value={profile.cardImage} onChange={(v) => upd("cardImage", v)} />
        </>
      }
    />
  );
}
