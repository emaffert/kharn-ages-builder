import { Fragment, useMemo, useRef, useState } from "react";
import { Button, Dialog } from "@ui";
import { useCatalogStore } from "./useCatalogStore";
import { LEVEL_LABEL } from "./admin/shared";
import { ProfileDetail } from "./admin/ProfileDetail";
import { EquipmentDetail } from "./admin/EquipmentDetail";
import { SkillCatalogDetail } from "./admin/SkillCatalogDetail";
import { SpecialCardDetail } from "./admin/SpecialCardDetail";
import { SpellDetail } from "./admin/SpellDetail";
import { MagicWaysDetail } from "./admin/MagicWaysDetail";
import { MountsDetail } from "./admin/MountsDetail";
import { MountOptionDetail } from "./admin/MountOptionDetail";
import { SettingsDetail } from "./admin/SettingsDetail";
import { AdminDocs } from "./admin/AdminDocs";
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
  | "settings";

// Navigation groupée par domaine (ordonnée), plutôt qu'une rangée d'onglets en vrac.
const NAV_GROUPS: { label: string; items: [AdminView, string][] }[] = [
  { label: "Figurines", items: [["profiles", "Profils"], ["special-cards", "Cartes spé."]] },
  { label: "Objets", items: [["equipment", "Équipement"], ["skills", "Compétences"]] },
  { label: "Magie", items: [["spells", "Sorts"], ["magic-ways", "Voies"]] },
  { label: "Montures", items: [["mounts", "Montures"], ["mount-options", "Options"]] },
  { label: "Réglages", items: [["settings", "Réglages"]] },
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
  const [pendingDelete, setPendingDelete] = useState<{ what: string; run: () => void } | null>(null);
  const [factionFilter, setFactionFilter] = useState("all");
  const [zoom, setZoom] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = store.importJson(await file.text());
    if (err) alert(`Import impossible : ${err}`);
  };

  const onSave = async () => {
    const err = await store.saveToProject();
    alert(err ? `Enregistrement impossible : ${err}` : "Catalogue enregistré dans le projet.");
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

  const selectedProfile = catalog.profiles.find((p) => p.id === selectedProfileId);
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
                <button key={g.label} onClick={() => setNavGroup(g.label)} className={tabClass(navGroup === g.label)}>
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
            {view === "settings" &&
              `${catalog.factions.length} faction(s) · ${catalog.grimoires.length} grimoire(s) · ${(catalog.munitionKinds ?? []).length} munition(s)`}
            {store.dirty && <span className="adm-accent"> · modifié</span>}
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {view === "profiles" &&
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
                        {p.name}
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
            })}
          {view === "equipment" && (
            <>
              {filteredEquipment.map((e, i) => {
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
                        <span>{e.name}</span>
                        <span className="text-xs adm-faint">{e.cost}</span>
                      </button>
                    </li>
                  </Fragment>
                );
              })}
              <li className="mt-2">
                <button
                  onClick={() => setSelectedEquipId(store.addEquipment())}
                  className="adm-add w-full py-1.5"
                >
                  + équipement
                </button>
              </li>
            </>
          )}
          {view === "skills" && (
            <>
              {filteredSkills.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelectedSkillId(s.id)} className={itemClass(s.id === selectedSkillId)}>
                    <span>{s.keyword}</span>
                    {s.hasValue && <span className="text-xs adm-faint">X</span>}
                  </button>
                </li>
              ))}
              <li className="mt-2">
                <button
                  onClick={() => setSelectedSkillId(store.addSkill())}
                  className="adm-add w-full py-1.5"
                >
                  + compétence
                </button>
              </li>
            </>
          )}
          {view === "special-cards" && (
            <>
              {filteredCards.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelectedCardId(s.id)} className={itemClass(s.id === selectedCardId)}>
                    <span>{s.name}</span>
                    <span className="text-xs adm-faint">{s.cost > 0 ? s.cost : "auto"}</span>
                  </button>
                </li>
              ))}
              <li className="mt-2">
                <button
                  onClick={() => setSelectedCardId(store.addSpecialCard())}
                  className="adm-add w-full py-1.5"
                >
                  + carte spéciale
                </button>
              </li>
            </>
          )}
          {view === "spells" && (
            <>
              {filteredSpells.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelectedSpellId(s.id)} className={itemClass(s.id === selectedSpellId)}>
                    <span>{s.name}</span>
                    {s.cost != null && <span className="text-xs adm-faint">{s.cost}</span>}
                  </button>
                </li>
              ))}
              <li className="mt-2">
                <button
                  onClick={() => setSelectedSpellId(store.addSpell())}
                  className="adm-add w-full py-1.5"
                >
                  + sort
                </button>
              </li>
            </>
          )}
          {view === "mounts" && (
            <>
              {catalog.mountTypes.map((t) => (
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
              ))}
              <li className="mt-2">
                <button
                  onClick={() => {
                    const tid = store.addMountType();
                    setSelectedMountId(store.addMount(tid));
                  }}
                  className="adm-add w-full py-1.5"
                >
                  + type de monture
                </button>
              </li>
            </>
          )}
          {view === "mount-options" && (
            <>
              {catalog.mountOptions.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setSelectedMountOptionId(o.id)}
                    className={itemClass(o.id === selectedMountOptionId)}
                  >
                    <span>{o.name}</span>
                    <span className="text-xs adm-faint">{o.bucket}</span>
                  </button>
                </li>
              ))}
              <li className="mt-2">
                <button onClick={() => setSelectedMountOptionId(store.addMountOption())} className="adm-add w-full py-1.5">
                  + option de monture
                </button>
              </li>
            </>
          )}
        </ul>

        <div className="adm-sidebar-foot flex flex-wrap gap-1.5 p-3">
          {import.meta.env.DEV && (
            <Button variant="primary" size="sm" className="flex-1" onClick={onSave}>
              Enregistrer
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={store.exportJson}>
            Exporter
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            Importer
          </Button>
          <Button size="sm" onClick={store.reset} disabled={!store.dirty}>
            Réinit.
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImport}
            className="hidden"
          />
        </div>
      </aside>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {view === "profiles" &&
            (selectedProfile ? (
              <div className="mx-auto max-w-2xl">
                <ProfileDetail
                  profile={selectedProfile}
                  cat={catalog}
                  updateField={store.updateField}
                  updateProfile={store.updateProfile}
                  updateModel={store.updateModel}
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
              <div className="mx-auto max-w-2xl">
                <EquipmentDetail
                  equipment={selectedEquip}
                  cat={catalog}
                  onChange={(patch) => store.updateEquipment(selectedEquip.id, patch)}
                  onRemove={() =>
                    setPendingDelete({
                      what: `l'équipement « ${selectedEquip.name} »`,
                      run: () => {
                        store.removeEquipment(selectedEquip.id);
                        setSelectedEquipId(catalog.equipment.find((x) => x.id !== selectedEquip.id)?.id ?? "");
                      },
                    })
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un équipement.</p>
            ))}
          {view === "skills" &&
            (selectedSkill ? (
              <div className="mx-auto max-w-2xl">
                <SkillCatalogDetail
                  key={selectedSkill.id}
                  skill={selectedSkill}
                  onChange={(patch) => store.updateSkill(selectedSkill.id, patch)}
                  onRenameId={(newId) => {
                    const ok = store.renameSkillId(selectedSkill.id, newId);
                    if (ok) setSelectedSkillId(newId);
                    return ok;
                  }}
                  onRemove={() =>
                    setPendingDelete({
                      what: `la compétence « ${selectedSkill.keyword} »`,
                      run: () => {
                        store.removeSkill(selectedSkill.id);
                        setSelectedSkillId(catalog.skills.find((x) => x.id !== selectedSkill.id)?.id ?? "");
                      },
                    })
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez une compétence.</p>
            ))}
          {view === "special-cards" &&
            (selectedCard ? (
              <div className="mx-auto max-w-2xl">
                <SpecialCardDetail
                  card={selectedCard}
                  cat={catalog}
                  onChange={(patch) => store.updateSpecialCard(selectedCard.id, patch)}
                  onRemove={() =>
                    setPendingDelete({
                      what: `la carte « ${selectedCard.name} »`,
                      run: () => {
                        store.removeSpecialCard(selectedCard.id);
                        setSelectedCardId(catalog.specialCards.find((x) => x.id !== selectedCard.id)?.id ?? "");
                      },
                    })
                  }
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez une carte spéciale.</p>
            ))}
          {view === "spells" &&
            (selectedSpell ? (
              <div className="mx-auto max-w-2xl">
                <SpellDetail
                  spell={selectedSpell}
                  cat={catalog}
                  onChange={(patch) => store.updateSpell(selectedSpell.id, patch)}
                  onRemove={() =>
                    setPendingDelete({
                      what: `le sort « ${selectedSpell.name} »`,
                      run: () => {
                        store.removeSpell(selectedSpell.id);
                        setSelectedSpellId(catalog.spells.find((x) => x.id !== selectedSpell.id)?.id ?? "");
                      },
                    })
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
              onRemove={store.removeMagicWay}
            />
          )}
          {view === "mounts" && (
            <MountsDetail
              cat={catalog}
              mountId={selectedMountId}
              onChangeType={store.updateMountType}
              onRemoveType={(id) => {
                store.removeMountType(id);
                setSelectedMountId(catalog.mounts.find((m) => m.typeId !== id)?.id ?? "");
              }}
              onChangeMount={store.updateMount}
              onRemoveMount={(id) => {
                store.removeMount(id);
                setSelectedMountId(catalog.mounts.find((m) => m.id !== id)?.id ?? "");
              }}
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
                  store.removeMountOption(id);
                  setSelectedMountOptionId(catalog.mountOptions.find((o) => o.id !== id)?.id ?? "");
                }}
              />
            ) : (
              <p className="adm-faint">Sélectionnez une option de monture.</p>
            ))}
          {view === "settings" && (
            <SettingsDetail
              cat={catalog}
              onAddFaction={store.addFaction}
              onUpdateFaction={store.updateFaction}
              onRemoveFaction={store.removeFaction}
              onUpdateGrimoire={store.updateGrimoire}
              onAddMunitionKind={store.addMunitionKind}
              onUpdateMunitionKind={store.updateMunitionKind}
              onRemoveMunitionKind={store.removeMunitionKind}
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
        <p>
          Supprimer {pendingDelete?.what} ? Cette action est <b>irréversible</b>.
        </p>
      </Dialog>
    </div>
  );
}
