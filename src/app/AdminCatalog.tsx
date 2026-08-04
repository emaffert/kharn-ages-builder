import { Fragment, useMemo, useState } from "react";
import { findReferences, type RefKind, type Reference } from "@core";
import { Button, Dialog } from "@ui";
import { useCatalogStore } from "./useCatalogStore";
import { LEVEL_LABEL, listLabel } from "./admin/shared";
import { ReferenceList } from "./admin/primitives";
import { ProfileDetail } from "./admin/ProfileDetail";
import { EquipmentDetail } from "./admin/EquipmentDetail";
import { SkillCatalogDetail } from "./admin/SkillCatalogDetail";
import { SpecialCardDetail } from "./admin/SpecialCardDetail";
import { SpellDetail } from "./admin/SpellDetail";
import { MagicWaysDetail } from "./admin/MagicWaysDetail";
import { MountsDetail } from "./admin/MountsDetail";
import { MountOptionDetail } from "./admin/MountOptionDetail";
import { isTechnicalId, suggestId } from "@core";
import { FactionsDetail } from "./admin/FactionsDetail";
import { SettingsDetail } from "./admin/SettingsDetail";
import { AdminDocs } from "./admin/AdminDocs";
import { WhatsNew } from "./admin/WhatsNew";
import { PublishAction } from "./admin/PublishAction";
import { NewVersionNotice } from "./admin/NewVersionNotice";
import { StaleDraftNotice } from "./admin/StaleDraftNotice";
import { PullPublishedAction } from "./admin/PullPublishedAction";
import { ResetToFileAction } from "./admin/ResetToFileAction";
import "./admin/admin.css";

// Ordre et libellés des catégories d'équipement pour le regroupement de la barre latérale.
const EQUIP_CAT_ORDER = ["arme-cac", "arme-tir", "bouclier", "armure", "objet"];
const EQUIP_CAT_LABEL: Record<string, string> = {
  "arme-cac": "Corps à corps",
  "arme-tir": "Tir",
  bouclier: "Boucliers",
  armure: "Armures",
  objet: "Objets",
};

type AdminView =
  | "profiles"
  | "equipment"
  | "skills"
  | "special-cards"
  | "spells"
  | "magic-ways"
  | "mounts"
  | "mount-options"
  | "factions"
  | "settings";

// Navigation groupée par domaine (ordonnée), plutôt qu'une rangée d'onglets en vrac.
const NAV_GROUPS: { label: string; items: [AdminView, string][] }[] = [
  { label: "Figurines", items: [["profiles", "Profils"], ["special-cards", "Cartes spé."]] },
  { label: "Objets", items: [["equipment", "Équipement"], ["skills", "Compétences"]] },
  { label: "Magie", items: [["spells", "Sorts"], ["magic-ways", "Voies"]] },
  { label: "Montures", items: [["mounts", "Montures"], ["mount-options", "Options"]] },
  { label: "Réglages", items: [["factions", "Factions"], ["settings", "Réglages"]] },
];

export function AdminCatalog() {
  const store = useCatalogStore();
  const { catalog } = store;
  const [view, setView] = useState<AdminView>("profiles");
  // Grande partie sélectionnée dans la nav (révèle ses sous-parties en dessous).
  const [navGroup, setNavGroup] = useState(NAV_GROUPS[0].label);
  const [selectedProfileId, setSelectedProfileId] = useState(catalog.profiles[0]?.id ?? "");
  const [selectedEquipId, setSelectedEquipId] = useState(catalog.equipment[0]?.id ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState(catalog.skills[0]?.id ?? "");
  const [selectedCardId, setSelectedCardId] = useState(catalog.specialCards[0]?.id ?? "");
  const [selectedSpellId, setSelectedSpellId] = useState(catalog.spells[0]?.id ?? "");
  const [selectedMountId, setSelectedMountId] = useState(catalog.mounts[0]?.id ?? "");
  const [selectedMountOptionId, setSelectedMountOptionId] = useState(catalog.mountOptions[0]?.id ?? "");
  const [query, setQuery] = useState("");
  // Suppression d'entité en attente de confirmation (modale au skin de l'app, action irréversible).
  const [pendingDelete, setPendingDelete] = useState<{ what: string; refs: Reference[]; run: () => void } | null>(null);
  const [factionFilter, setFactionFilter] = useState("all");
  const [zoom, setZoom] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  const onSave = async () => {
    const { frozen, error } = await store.saveToProject();
    if (error) {
      alert(`Enregistrement impossible : ${error}`);
      return;
    }
    // Le nombre d'icônes figées se dit : ce sont de nouveaux fichiers dans `src/assets/icons/`,
    // à committer avec le catalogue sous peine de le laisser citer des images absentes du dépôt.
    alert(
      frozen > 0
        ? `Catalogue enregistré, ${frozen} icône(s) écrite(s) dans src/assets/icons/ (à committer).`
        : "Catalogue enregistré dans le projet.",
    );
  };

  const q = query.trim().toLowerCase();
  // Regroupés par faction (ordre du catalogue), puis par nom de groupe (modèle), puis par niveau
  // croissant : toutes les figurines d'un même groupe se suivent, du niveau I au III.
  const filteredProfiles = useMemo(() => {
    const factionRank = (id?: string) => {
      const i = catalog.factions.findIndex((f) => f.id === id);
      return i < 0 ? catalog.factions.length : i;
    };
    const groupName = (p: (typeof catalog.profiles)[number]) =>
      (p.modelId != null ? catalog.models.find((m) => m.id === p.modelId)?.name : undefined) ?? p.name;
    return catalog.profiles
      .filter(
        (p) =>
          (!q || p.name.toLowerCase().includes(q)) &&
          (factionFilter === "all" || p.factionId === factionFilter),
      )
      .sort(
        (a, b) =>
          factionRank(a.factionId) - factionRank(b.factionId) ||
          groupName(a).localeCompare(groupName(b), "fr") ||
          (a.level ?? 0) - (b.level ?? 0) ||
          a.name.localeCompare(b.name, "fr"),
      );
  }, [catalog, q, factionFilter]);
  const filteredEquipment = useMemo(() => {
    const rank = (c: string) => {
      const i = EQUIP_CAT_ORDER.indexOf(c);
      return i < 0 ? 99 : i;
    };
    return catalog.equipment
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name, "fr"));
  }, [catalog, q]);

  const filteredSkills = useMemo(
    () =>
      [...catalog.skills]
        .filter((s) => !q || s.keyword.toLowerCase().includes(q))
        .sort((a, b) => a.keyword.localeCompare(b.keyword)),
    [catalog, q],
  );

  const filteredCards = useMemo(
    () =>
      catalog.specialCards
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [catalog, q],
  );
  const filteredSpells = useMemo(
    () => catalog.spells.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [catalog, q],
  );

  /**
   * Ouvre la confirmation de suppression d'une entité du graphe : les citations sont relevées
   * *avant* d'agir, pour être montrées, puis retirées avec elle (cf. `removeEntity`). Toute
   * suppression de l'écran passe par ici - une suppression sèche laisserait des références
   * orphelines. `resettle` replace la sélection, que l'entité supprimée emporte.
   */
  const confirmRemove = (kind: RefKind, id: string, what: string, resettle: () => void) =>
    setPendingDelete({
      what,
      refs: findReferences(catalog, kind, id),
      run: () => {
        store.removeEntity(kind, id);
        resettle();
      },
    });

  /** Voisin de `id` dans la liste affichée : supprimer ne doit pas renvoyer à l'autre bout du catalogue. */
  const neighbourOf = (shown: readonly { id: string }[], id: string): string => {
    const i = shown.findIndex((e) => e.id === id);
    return (shown[i + 1] ?? shown[i - 1])?.id ?? "";
  };

  /** Renomme une entité, en cascade, et suit la sélection - faite par identifiant. */
  const rename = (kind: RefKind, oldId: string, newId: string, select: (id: string) => void) => {
    store.renameEntityId(kind, oldId, newId);
    select(newId);
  };
  /**
   * Baptême d'une entité qui porte encore l'identifiant de sa création, une fois son nom saisi.
   * Sans effet si elle en a déjà un vrai ; la sélection suit le nouvel identifiant.
   */
  const slugify = (kind: RefKind, id: string, select: (id: string) => void) => {
    if (!isTechnicalId(id)) return;
    const next = suggestId(catalog, kind, id);
    if (!next) return;
    store.slugifyEntityId(kind, id);
    select(next);
  };

  const selectedProfile = catalog.profiles.find((p) => p.id === selectedProfileId);
  // Faction d'une figurine créée depuis la liste : celle qu'on est en train de regarder (filtre,
  // sinon fiche ouverte). Une figurine sans faction n'est recrutable nulle part, donc on n'en
  // propose jamais : à défaut, la première du catalogue, que la fiche permet de changer.
  const newProfileFaction =
    (factionFilter !== "all" ? factionFilter : selectedProfile?.factionId) ?? catalog.factions[0]?.id;
  const newProfileFactionName = catalog.factions.find((f) => f.id === newProfileFaction)?.name;
  const selectedEquip = catalog.equipment.find((e) => e.id === selectedEquipId);
  const selectedSkill = catalog.skills.find((s) => s.id === selectedSkillId);
  const selectedCard = catalog.specialCards.find((s) => s.id === selectedCardId);
  const selectedSpell = catalog.spells.find((s) => s.id === selectedSpellId);
  const selectedMountOption = catalog.mountOptions.find((o) => o.id === selectedMountOptionId);
  const selectedMount = catalog.mounts.find((m) => m.id === selectedMountId);
  const selectedMountType = selectedMount
    ? catalog.mountTypes.find((t) => t.id === selectedMount.typeId)
    : undefined;

  const previewImage =
    view === "profiles"
      ? selectedProfile?.cardImage
      : view === "equipment"
        ? selectedEquip?.cardImage
        : view === "special-cards"
          ? selectedCard?.cardImage
          : view === "spells"
            ? selectedSpell?.cardImage
            : view === "mounts"
              ? selectedMountType?.cardImage
              : undefined;

  const tabClass = (active: boolean) => `adm-tab ${active ? "adm-tab--on" : ""}`;
  const itemClass = (active: boolean) => `adm-item ${active ? "adm-item--on" : ""}`;

  /**
   * Création d'une entrée de la partie affichée. Le bouton vit en tête de la barre latérale, avec
   * le compte et la recherche : en pied de liste, il fallait dérouler 113 profils pour l'atteindre.
   * La recherche est effacée au passage, sans quoi la nouvelle entrée naîtrait hors du filtre et
   * paraîtrait perdue.
   */
  const addActions: Partial<Record<AdminView, { label: string; title: string; run: () => void }>> = {
    profiles: {
      label: "+ profil",
      title: `Créer un profil dans la faction ${newProfileFactionName ?? "-"}`,
      run: () => setSelectedProfileId(store.addProfile(newProfileFaction)),
    },
    equipment: { label: "+ équipement", title: "Créer un équipement", run: () => setSelectedEquipId(store.addEquipment()) },
    skills: { label: "+ compétence", title: "Créer une compétence", run: () => setSelectedSkillId(store.addSkill()) },
    "special-cards": { label: "+ carte", title: "Créer une carte spéciale", run: () => setSelectedCardId(store.addSpecialCard()) },
    spells: { label: "+ sort", title: "Créer un sort", run: () => setSelectedSpellId(store.addSpell()) },
    mounts: {
      label: "+ monture",
      title: "Créer un type de monture, avec son premier niveau",
      run: () => setSelectedMountId(store.addMount(store.addMountType())),
    },
    "mount-options": { label: "+ option", title: "Créer une option de monture", run: () => setSelectedMountOptionId(store.addMountOption()) },
  };
  const addAction = addActions[view];

  return (
    <div className="adm-shell flex h-full">
      <aside className="adm-sidebar flex w-72 shrink-0 flex-col">
        <div className="adm-sidebar-head space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="adm-accent text-sm font-bold">Khârn-Âges - Admin catalogue</h1>
            <button onClick={() => setShowDocs(true)} className="adm-tab" title="Aide sur l'édition du catalogue">
              Aide
            </button>
          </div>
          <nav className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {NAV_GROUPS.map((g) => (
                <button
                  key={g.label}
                  /* Choisir une grande partie ouvre sa première sous-partie : on ne reste jamais sur
                     la page de la partie précédente en ayant l'air d'avoir changé de section. */
                  onClick={() => {
                    setNavGroup(g.label);
                    setView(g.items[0][0]);
                  }}
                  className={tabClass(navGroup === g.label)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t pt-1.5 adm-bd-soft">
              {(NAV_GROUPS.find((g) => g.label === navGroup)?.items ?? []).map(([id, label]) => (
                <button key={id} onClick={() => setView(id)} className={tabClass(view === id)}>
                  {label}
                </button>
              ))}
            </div>
          </nav>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="adm-input w-full pr-7"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} title="Effacer" className="adm-search-x">
                ✕
              </button>
            )}
          </div>
          {view === "profiles" && (
            <select
              value={factionFilter}
              onChange={(e) => setFactionFilter(e.target.value)}
              className="adm-input w-full"
            >
              <option value="all">Toutes les factions</option>
              {catalog.factions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="adm-faint text-xs">
              {view === "profiles" &&
                `${filteredProfiles.length} profil(s) · ${store.unverifiedCount} champ(s) ⚠`}
              {view === "equipment" && `${filteredEquipment.length} équipement(s)`}
              {view === "skills" && `${filteredSkills.length} compétence(s)`}
              {view === "special-cards" && `${filteredCards.length} carte(s) spéciale(s)`}
              {view === "spells" && `${filteredSpells.length} sort(s)`}
              {view === "magic-ways" && `${catalog.magicWays.length} voie(s) de magie`}
              {view === "mounts" && `${catalog.mountTypes.length} type(s) · ${catalog.mounts.length} niveau(x)`}
              {view === "mount-options" && `${catalog.mountOptions.length} option(s)`}
              {view === "factions" && `${catalog.factions.length} faction(s)`}
              {view === "settings" &&
                `${catalog.grimoires.length} grimoire(s) · ${(catalog.munitionKinds ?? []).length} munition(s)`}
              {store.dirty && <span className="adm-accent"> · modifié</span>}
            </p>
            {addAction && (
              <button
                onClick={() => {
                  setQuery("");
                  addAction.run();
                }}
                title={addAction.title}
                className="adm-add shrink-0"
              >
                {addAction.label}
              </button>
            )}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {view === "profiles" && (
            filteredProfiles.map((p, i) => {
              const showHeader = i === 0 || filteredProfiles[i - 1].factionId !== p.factionId;
              const factionName =
                catalog.factions.find((f) => f.id === p.factionId)?.name ?? "Sans logo";
              return (
                <Fragment key={p.id}>
                  {showHeader && (
                    <li className="mt-3 mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider adm-faint">
                      {factionName}
                    </li>
                  )}
                  <li>
                    <button onClick={() => setSelectedProfileId(p.id)} className={itemClass(p.id === selectedProfileId)}>
                      <span>
                        {listLabel(p.name)}
                        {p.level && <span className="ml-1 adm-faint">{LEVEL_LABEL[p.level]}</span>}
                      </span>
                      <span className="flex items-center gap-1 text-xs adm-faint">
                        {(p.unverifiedFields?.length ?? 0) > 0 && <span className="adm-accent">⚠</span>}
                        {p.cost}
                      </span>
                    </button>
                  </li>
                </Fragment>
              );
            })
          )}
          {view === "equipment" && (
            filteredEquipment.map((e, i) => {
              const showHeader = i === 0 || filteredEquipment[i - 1].category !== e.category;
              return (
                <Fragment key={e.id}>
                  {showHeader && (
                    <li className="mt-3 mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider adm-faint">
                      {EQUIP_CAT_LABEL[e.category] ?? e.category}
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => setSelectedEquipId(e.id)}
                      className={itemClass(e.id === selectedEquipId)}
                    >
                      <span>{listLabel(e.name)}</span>
                      <span className="text-xs adm-faint">{e.cost}</span>
                    </button>
                  </li>
                </Fragment>
              );
            })
          )}
          {view === "skills" && (
            filteredSkills.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelectedSkillId(s.id)} className={itemClass(s.id === selectedSkillId)}>
                  <span>{s.keyword}</span>
                  {s.hasValue && <span className="text-xs adm-faint">X</span>}
                </button>
              </li>
            ))
          )}
          {view === "special-cards" && (
            filteredCards.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelectedCardId(s.id)} className={itemClass(s.id === selectedCardId)}>
                  <span>{listLabel(s.name)}</span>
                  <span className="text-xs adm-faint">{s.cost > 0 ? s.cost : "auto"}</span>
                </button>
              </li>
            ))
          )}
          {view === "spells" && (
            filteredSpells.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelectedSpellId(s.id)} className={itemClass(s.id === selectedSpellId)}>
                  <span>{listLabel(s.name)}</span>
                  {s.cost != null && <span className="text-xs adm-faint">{s.cost}</span>}
                </button>
              </li>
            ))
          )}
          {view === "mounts" && (
            catalog.mountTypes.map((t) => (
              <Fragment key={t.id}>
                <li className="mt-3 mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider adm-faint">
                  {t.name}
                </li>
                {catalog.mounts
                  .filter((m) => m.typeId === t.id)
                  .sort((a, b) => a.level - b.level)
                  .map((m) => (
                    <li key={m.id}>
                      <button onClick={() => setSelectedMountId(m.id)} className={itemClass(m.id === selectedMountId)}>
                        <span>Niveau {LEVEL_LABEL[m.level]}</span>
                        <span className="text-xs adm-faint">{m.cost}</span>
                      </button>
                    </li>
                  ))}
                <li>
                  <button onClick={() => setSelectedMountId(store.addMount(t.id))} className="adm-add w-full py-1 text-xs">
                    + niveau
                  </button>
                </li>
              </Fragment>
            ))
          )}
          {view === "mount-options" && (
            catalog.mountOptions.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setSelectedMountOptionId(o.id)}
                  className={itemClass(o.id === selectedMountOptionId)}
                >
                  <span>{listLabel(o.name)}</span>
                  <span className="text-xs adm-faint">{o.bucket}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="adm-sidebar-foot flex flex-wrap gap-1.5 p-3">
          <PublishAction catalog={catalog} dirty={store.dirty} onPublished={store.adoptPublished} />
          {/* Outils de développement : ils écrivent dans le dépôt ou rejouent une source de
              référence, ce qui n'a de sens que sur la machine du développeur. */}
          {import.meta.env.DEV && (
            <>
              <Button variant="primary" size="sm" onClick={onSave}>
                Enregistrer
              </Button>
              <PullPublishedAction dirty={store.dirty} onPulled={store.adoptPublished} />
              <ResetToFileAction dirty={store.dirty} onReset={store.resetToFile} />
            </>
          )}
        </div>
      </aside>

      <main className="flex flex-1 overflow-hidden">
        <div className="adm-scroll flex-1 overflow-y-auto p-8">
          <NewVersionNotice />
          <StaleDraftNotice />
          {view === "profiles" &&
            (selectedProfile ? (
              <div className="contents">
                <ProfileDetail
                  onRenameId={(newId) => rename("profile", selectedProfile.id, newId, setSelectedProfileId)}
                  onSlugifyId={() => slugify("profile", selectedProfile.id, setSelectedProfileId)}
                  onRemove={() =>
                    confirmRemove("profile", selectedProfile.id, `le profil « ${selectedProfile.name} »`, () =>
                      setSelectedProfileId(neighbourOf(filteredProfiles, selectedProfile.id)),
                    )
                  }
                  profile={selectedProfile}
                  cat={catalog}
                  updateField={store.updateField}
                  updateProfile={store.updateProfile}
                  renameModel={store.renameModel}
                  addModel={store.addModel}
                  assignProfileToModel={store.assignProfileToModel}
                  setIcon={store.setIcon}
                  toggleUnverified={store.toggleUnverified}
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un profil.</p>
            ))}
          {view === "equipment" &&
            (selectedEquip ? (
              <div className="contents">
                <EquipmentDetail
                  equipment={selectedEquip}
                  cat={catalog}
                  onChange={(patch) => store.updateEquipment(selectedEquip.id, patch)}
                  onRenameId={(newId) => rename("equipment", selectedEquip.id, newId, setSelectedEquipId)}
                  onSlugifyId={() => slugify("equipment", selectedEquip.id, setSelectedEquipId)}
                  onRemove={() =>
                    confirmRemove("equipment", selectedEquip.id, `l'équipement « ${selectedEquip.name} »`, () =>
                      setSelectedEquipId(neighbourOf(filteredEquipment, selectedEquip.id)),
                    )
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un équipement.</p>
            ))}
          {view === "skills" &&
            (selectedSkill ? (
              <div className="contents">
                <SkillCatalogDetail
                  key={selectedSkill.id}
                  skill={selectedSkill}
                  cat={catalog}
                  onChange={(patch) => store.updateSkill(selectedSkill.id, patch)}
                  onRenameId={(newId) => rename("skill", selectedSkill.id, newId, setSelectedSkillId)}
                  onSlugifyId={() => slugify("skill", selectedSkill.id, setSelectedSkillId)}
                  onRemove={() =>
                    confirmRemove("skill", selectedSkill.id, `la compétence « ${selectedSkill.keyword} »`, () =>
                      setSelectedSkillId(neighbourOf(filteredSkills, selectedSkill.id)),
                    )
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez une compétence.</p>
            ))}
          {view === "special-cards" &&
            (selectedCard ? (
              <div className="contents">
                <SpecialCardDetail
                  card={selectedCard}
                  cat={catalog}
                  onChange={(patch) => store.updateSpecialCard(selectedCard.id, patch)}
                  onRenameId={(newId) => rename("specialCard", selectedCard.id, newId, setSelectedCardId)}
                  onSlugifyId={() => slugify("specialCard", selectedCard.id, setSelectedCardId)}
                  onRemove={() =>
                    confirmRemove("specialCard", selectedCard.id, `la carte « ${selectedCard.name} »`, () =>
                      setSelectedCardId(neighbourOf(filteredCards, selectedCard.id)),
                    )
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez une carte spéciale.</p>
            ))}
          {view === "spells" &&
            (selectedSpell ? (
              <div className="contents">
                <SpellDetail
                  spell={selectedSpell}
                  cat={catalog}
                  onChange={(patch) => store.updateSpell(selectedSpell.id, patch)}
                  onRenameId={(newId) => rename("spell", selectedSpell.id, newId, setSelectedSpellId)}
                  onSlugifyId={() => slugify("spell", selectedSpell.id, setSelectedSpellId)}
                  onRemove={() =>
                    confirmRemove("spell", selectedSpell.id, `le sort « ${selectedSpell.name} »`, () =>
                      setSelectedSpellId(neighbourOf(filteredSpells, selectedSpell.id)),
                    )
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un sort.</p>
            ))}
          {view === "magic-ways" && (
            <MagicWaysDetail
              cat={catalog}
              onAdd={store.addMagicWay}
              onChange={store.updateMagicWay}
              onRemove={(id) =>
                confirmRemove(
                  "magicWay",
                  id,
                  `la voie « ${catalog.magicWays.find((w) => w.id === id)?.name ?? id} »`,
                  () => {},
                )
              }
            />
          )}
          {view === "mounts" && (
            <MountsDetail
              cat={catalog}
              mountId={selectedMountId}
              onChangeType={store.updateMountType}
              onRemoveType={(id) =>
                confirmRemove(
                  "mountType",
                  id,
                  `le type de monture « ${catalog.mountTypes.find((t) => t.id === id)?.name ?? id} » et ses niveaux`,
                  () => setSelectedMountId(catalog.mounts.find((m) => m.typeId !== id)?.id ?? ""),
                )
              }
              onChangeMount={store.updateMount}
              onRenameId={(newId) => rename("mount", selectedMountId, newId, setSelectedMountId)}
              onRemoveMount={(id) =>
                confirmRemove("mount", id, "ce niveau de monture", () =>
                  setSelectedMountId(neighbourOf(catalog.mounts, id)),
                )
              }
              setIcon={store.setIcon}
            />
          )}
          {view === "mount-options" &&
            (selectedMountOption ? (
              <MountOptionDetail
                option={selectedMountOption}
                cat={catalog}
                onChange={(patch) => store.updateMountOption(selectedMountOption.id, patch)}
                onRemove={() => {
                  const id = selectedMountOption.id;
                  confirmRemove("mountOption", id, `l'option « ${selectedMountOption.name} »`, () =>
                    setSelectedMountOptionId(neighbourOf(catalog.mountOptions, id)),
                  );
                }}
              />
            ) : (
              <p className="adm-faint">Sélectionnez une option de monture.</p>
            ))}
          {view === "factions" && (
            <FactionsDetail
              cat={catalog}
              onAddFaction={store.addFaction}
              onUpdateFaction={store.updateFaction}
              onRemoveFaction={store.removeFaction}
            />
          )}
          {view === "settings" && (
            <SettingsDetail
              cat={catalog}
              onUpdateGrimoire={store.updateGrimoire}
              onAddMunitionKind={store.addMunitionKind}
              onUpdateMunitionKind={store.updateMunitionKind}
              onRemoveMunitionKind={store.removeMunitionKind}
              onUpdateSettings={store.updateSettings}
              onSlugifyAllIds={store.slugifyAllIds}
            />
          )}
        </div>

        {import.meta.env.DEV && previewImage && (
          <aside className="adm-preview hidden w-[600px] shrink-0 overflow-y-auto p-4 xl:block">
            <p className="adm-section-title mb-2">Carte (dev) - cliquer pour agrandir</p>
            <img
              key={previewImage}
              src={`/${previewImage}`}
              alt="Carte"
              loading="lazy"
              onClick={() => setZoom(`/${previewImage}`)}
              className="adm-bd w-full cursor-zoom-in rounded border"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <p className="adm-faint mt-2 break-all text-xs">{previewImage}</p>
          </aside>
        )}
      </main>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="adm-scrim fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center p-4"
        >
          <img src={zoom} alt="Carte agrandie" className="max-h-[95vh] max-w-[95vw] rounded shadow-2xl" />
        </div>
      )}

      {showDocs && <AdminDocs onClose={() => setShowDocs(false)} />}

      <WhatsNew />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        size="sm"
        title="Confirmer la suppression"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                pendingDelete?.run();
                setPendingDelete(null);
              }}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>
            Supprimer {pendingDelete?.what} ? Cette action est <b>irréversible</b>.
          </p>
          {pendingDelete && <ReferenceList refs={pendingDelete.refs} />}
        </div>
      </Dialog>
    </div>
  );
}
