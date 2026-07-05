import { useMemo, useRef, useState } from "react";
import { Button } from "@ui";
import { useCatalogStore } from "./useCatalogStore";
import { LEVEL_LABEL } from "./admin/shared";
import { ProfileDetail } from "./admin/ProfileDetail";
import { EquipmentDetail } from "./admin/EquipmentDetail";
import { SkillCatalogDetail } from "./admin/SkillCatalogDetail";
import { SpecialCardDetail } from "./admin/SpecialCardDetail";
import { SpellDetail } from "./admin/SpellDetail";
import { AdminDocs } from "./admin/AdminDocs";
import "./admin/admin.css";

export function AdminCatalog() {
  const store = useCatalogStore();
  const { catalog } = store;
  const [view, setView] = useState<"profiles" | "equipment" | "skills" | "special-cards" | "spells">(
    "profiles",
  );
  const [selectedProfileId, setSelectedProfileId] = useState(catalog.profiles[0]?.id ?? "");
  const [selectedEquipId, setSelectedEquipId] = useState(catalog.equipment[0]?.id ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState(catalog.skills[0]?.id ?? "");
  const [selectedCardId, setSelectedCardId] = useState(catalog.specialCards[0]?.id ?? "");
  const [selectedSpellId, setSelectedSpellId] = useState(catalog.spells[0]?.id ?? "");
  const [query, setQuery] = useState("");
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
  const filteredProfiles = useMemo(
    () =>
      catalog.profiles.filter(
        (p) =>
          (!q || p.name.toLowerCase().includes(q)) &&
          (factionFilter === "all" || p.factionId === factionFilter),
      ),
    [catalog, q, factionFilter],
  );
  const filteredEquipment = useMemo(
    () => catalog.equipment.filter((e) => !q || e.name.toLowerCase().includes(q)),
    [catalog, q],
  );

  const filteredSkills = useMemo(
    () =>
      [...catalog.skills]
        .filter((s) => !q || s.keyword.toLowerCase().includes(q))
        .sort((a, b) => a.keyword.localeCompare(b.keyword)),
    [catalog, q],
  );

  const filteredCards = useMemo(
    () => catalog.specialCards.filter((s) => !q || s.name.toLowerCase().includes(q)),
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

  const previewImage =
    view === "profiles"
      ? selectedProfile?.cardImage
      : view === "equipment"
        ? selectedEquip?.cardImage
        : view === "special-cards"
          ? selectedCard?.cardImage
          : view === "spells"
            ? selectedSpell?.cardImage
            : undefined;

  const tabClass = (active: boolean) => `adm-tab ${active ? "adm-tab--on" : ""}`;
  const itemClass = (active: boolean) => `adm-item ${active ? "adm-item--on" : ""}`;

  return (
    <div className="adm-shell flex h-full">
      <aside className="adm-sidebar flex w-72 shrink-0 flex-col">
        <div className="adm-sidebar-head space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="adm-accent text-sm font-bold">Khârn-Âges — Admin catalogue</h1>
            <button onClick={() => setShowDocs(true)} className="adm-tab" title="Aide sur l'édition du catalogue">
              Aide
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setView("profiles")} className={tabClass(view === "profiles")}>
              Profils
            </button>
            <button onClick={() => setView("equipment")} className={tabClass(view === "equipment")}>
              Équipement
            </button>
            <button onClick={() => setView("skills")} className={tabClass(view === "skills")}>
              Compétences
            </button>
            <button onClick={() => setView("special-cards")} className={tabClass(view === "special-cards")}>
              Cartes spé.
            </button>
            <button onClick={() => setView("spells")} className={tabClass(view === "spells")}>
              Sorts
            </button>
          </div>
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
          <div className="flex flex-wrap gap-1.5">
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
          <p className="adm-faint text-xs">
            {view === "profiles" &&
              `${filteredProfiles.length} profil(s) · ${store.unverifiedCount} champ(s) ⚠`}
            {view === "equipment" && `${filteredEquipment.length} équipement(s)`}
            {view === "skills" && `${filteredSkills.length} compétence(s)`}
            {view === "special-cards" && `${filteredCards.length} carte(s) spéciale(s)`}
            {view === "spells" && `${filteredSpells.length} sort(s)`}
            {store.dirty && <span className="adm-accent"> · modifié</span>}
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {view === "profiles" &&
            filteredProfiles.map((p) => (
              <li key={p.id}>
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
            ))}
          {view === "equipment" && (
            <>
              {filteredEquipment.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelectedEquipId(e.id)} className={itemClass(e.id === selectedEquipId)}>
                    <span>
                      {e.name}
                      <span className="ml-1 adm-faint">{e.category}</span>
                    </span>
                    <span className="text-xs adm-faint">{e.cost}</span>
                  </button>
                </li>
              ))}
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
        </ul>
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
                  onRemove={() => {
                    store.removeEquipment(selectedEquip.id);
                    setSelectedEquipId(catalog.equipment.find((x) => x.id !== selectedEquip.id)?.id ?? "");
                  }}
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un équipement.</p>
            ))}
          {view === "skills" &&
            (selectedSkill ? (
              <div className="mx-auto max-w-2xl">
                <SkillCatalogDetail
                  skill={selectedSkill}
                  onChange={(patch) => store.updateSkill(selectedSkill.id, patch)}
                  onRemove={() => {
                    store.removeSkill(selectedSkill.id);
                    setSelectedSkillId(catalog.skills.find((x) => x.id !== selectedSkill.id)?.id ?? "");
                  }}
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
                  onRemove={() => {
                    store.removeSpecialCard(selectedCard.id);
                    setSelectedCardId(catalog.specialCards.find((x) => x.id !== selectedCard.id)?.id ?? "");
                  }}
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
                  onRemove={() => {
                    store.removeSpell(selectedSpell.id);
                    setSelectedSpellId(catalog.spells.find((x) => x.id !== selectedSpell.id)?.id ?? "");
                  }}
                />
              </div>
            ) : (
              <p className="adm-faint">Sélectionnez un sort.</p>
            ))}
        </div>

        {import.meta.env.DEV && previewImage && (
          <aside className="adm-preview hidden w-[600px] shrink-0 overflow-y-auto p-4 xl:block">
            <p className="adm-section-title mb-2">Carte (dev) — cliquer pour agrandir</p>
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
    </div>
  );
}
