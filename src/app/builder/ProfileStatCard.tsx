import { specialCardsForProfile } from "@ui/explain";
import { Tag, STAT_FULL } from "@ui";
import { iconFor, type Armor, type Catalog, type EquipmentCostRule, type MasteryDomain, type Profile } from "@core";
import { SectionTitle } from "./components";
import { ArmorBlock, RulesBlock, SheetHeader, SkillChips, StatCell, type ArmorDisplay } from "./StatSheet";
import { MasteryDie } from "./MasteryDie";
import {
  LEVEL,
  STATS_COMBAT,
  STATS_SECONDARY,
  equipInfo,
  equipBits,
  spellInfo,
  type ItemInfo,
} from "./shared";

/** Modifications apportées par des effets (pour l'affichage : couleur « braise » + infobulle). */
export type ProfileMods = {
  statDeltas?: Record<string, number>;
  /** Valeurs de compétences calculées par effet (skillId -> valeur), ex. Seigneur de guerre. */
  skillValues?: Record<string, number>;
  /** Compétences octroyées par effet, avec valeur éventuelle (ex. Héroïque « défense »). */
  grantedSkills?: { skillId: string; value?: string | number; precision?: string }[];
  grantedTraitIds?: string[];
  /** Améliorations d'équipement octroyées (opt-in par objet, ex. arme empoisonnée). */
  grantedUpgrades?: { upgradeId: string; label: string; cost: number; equipmentCategories: string[] }[];
  /** Provenance des modifications (clé « stat:… » / « skill:… » / « trait:… » → effets responsables). */
  effectSources?: Record<string, { label: string; text: string }[]>;
  /** Dés de maîtrise octroyés par effet (ex. Bannière Khéropse). */
  grantedMasteryDice?: MasteryDomain[][];
  /** Bonus à la limitation « X » (effet `limit-modifier`, ex. Lieutenant : +1). Source dans `effectSources["limit"]`. */
  limitBonus?: number;
  /** Règles de remise par objet applicables à la figurine (ex. Ogodeï, Commandant). */
  equipmentCostRules?: EquipmentCostRule[];
  /** Bonus d'allonge (toises) apporté par la monture. Affiché en ligne dédiée. */
  mountAllonge?: number;
  /** Réduction de prix de grimoire par palier (ex. Mochère : { petit } / { grand }). Affichée dans « Magie ». */
  grimoireDiscount?: Record<string, number>;
};

/** Une armure -> bloc d'affichage (libellé « 🛡 Armure »). */
function armorDisplay(a: Armor): ArmorDisplay {
  return {
    label: "🛡 Armure",
    protectionEchec: a.protectionEchec,
    seuil: a.seuil,
    protectionReussite: a.protectionReussite,
    durability: a.durability,
  };
}

/** Carte de statistiques d'un profil (tags, stats, compétences cliquables, règles) + cartes liées. */
export function ProfileStatCard({
  p,
  cat,
  onInfo,
  showEquipment = false,
  upgrades,
  onToggleUpgrade,
  upgradeCounts,
  onSetUpgradeCount,
  mods,
  wornArmors,
}: {
  p: Profile;
  cat: Catalog;
  onInfo: (info: ItemInfo) => void;
  showEquipment?: boolean;
  /** En édition : liste des améliorations achetées + bascule (cases à cocher dans la carte). */
  upgrades?: string[];
  onToggleUpgrade?: (id: string) => void;
  /** Quantités des améliorations *empilables* (`perLevelStack`), + setter (stepper 0..niveau). */
  upgradeCounts?: Record<string, number>;
  onSetUpgradeCount?: (id: string, qty: number) => void;
  /** Modifications d'effets à refléter sur le profil affiché (stats/compétences/traits). */
  mods?: ProfileMods;
  /** Armures portées (équipement de catégorie « armure », ex. Brigandine), affichées après l'armure innée. */
  wornArmors?: ArmorDisplay[];
}) {
  // Effets responsables d'une modification affichée (clé « stat:… » / « skill:… »).
  const sourceRefs = (key: string) => mods?.effectSources?.[key] ?? [];
  // Rend une caractéristique en tenant compte d'un éventuel modificateur d'effet (cellule partagée).
  const statCell = (k: string, label: string, base: number | null | undefined) => {
    const d = mods?.statDeltas?.[k];
    const value = d != null ? (typeof base === "number" ? base : 0) + d : base;
    const showSource = () => {
      const src = sourceRefs(`stat:${k}`);
      onInfo({
        title: STAT_FULL[k] ?? label,
        price: "",
        lines: [],
        sources: src.length ? src : [{ label: "Effet", text: "Caractéristique modifiée par un effet." }],
      });
    };
    return <StatCell key={label} label={label} value={value ?? "-"} fx={d != null} onClick={d != null ? showSource : undefined} />;
  };
  // Compétences affichées : natives + octroyées par effet, en fusionnant les valeurs d'une même
  // compétence « à valeur » (ex. « Héroïque objectif » + octroi « défense » → « Héroïque objectif et défense »).
  type SkillAgg = { skillId: string; nativeVals: (string | number)[]; grantedVals: (string | number)[]; native: boolean };
  const skillOrder: string[] = [];
  const skillAgg = new Map<string, SkillAgg>();
  const ensureSkill = (id: string) => {
    let a = skillAgg.get(id);
    if (!a) {
      a = { skillId: id, nativeVals: [], grantedVals: [], native: false };
      skillAgg.set(id, a);
      skillOrder.push(id);
    }
    return a;
  };
  for (const s of p.skills) {
    const a = ensureSkill(s.skillId);
    a.native = true;
    if (s.value != null) a.nativeVals.push(s.value);
  }
  const grantedOnly = new Set<string>();
  for (const g of mods?.grantedSkills ?? []) {
    const a = ensureSkill(g.skillId);
    if (!a.native) grantedOnly.add(g.skillId); // compétence entièrement octroyée par effet
    if (g.value != null && !a.nativeVals.includes(g.value) && !a.grantedVals.includes(g.value)) {
      a.grantedVals.push(g.value);
    }
  }
  const grantedTraits = mods?.grantedTraitIds ?? [];
  // Sorts connus d'office (signature) - affichés même pour les non-mages, cliquables.
  // Sorts connus d'office = effets `grant-spell` du profil ciblant lui-même (affichés même sans voie).
  const innateSpells = (p.effects ?? [])
    .flatMap((e) => (e.operation.kind === "grant-spell" && e.target.self ? [e.operation.spellId] : []))
    .map((id) => cat.spells.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const cards = specialCardsForProfile(p, cat);
  const autoCards = cards.filter((c) => !c.amelioration); // appliquées d'office
  const ameliorations = cards.filter((c) => c.amelioration); // achetables
  const canEditUpgrades = Boolean(onToggleUpgrade);
  const precisions = p.skills.filter((s) => s.precision);
  // Précisions issues de compétences octroyées par effet (ex. « Spécialiste : hache »).
  const grantedPrecisions = (mods?.grantedSkills ?? []).filter((g) => g.precision);
  const baseEq = p.baseEquipmentIds
    .map((id) => cat.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  // `fx` : la compétence est *affichée comme modifiée* (couleur braise) → on montre la provenance.
  // Une compétence native que l'effet ne fait que redonder n'est pas « fx » et n'affiche pas de source.
  const showSkill = (skillId: string, label: string, fx = false) => {
    const sk = cat.skills.find((x) => x.id === skillId);
    const src = fx ? sourceRefs(`skill:${skillId}`) : [];
    onInfo({
      title: label,
      price: "compétence",
      lines: [sk?.sourceText ?? "Description indisponible."],
      sources: src.length ? src : undefined,
    });
  };
  // Limitation « X » corrigée par un effet `limit-modifier` (ex. Lieutenant : +1) → affichée en braise, cliquable.
  const limBonus = p.limitation.kind === "X" ? (mods?.limitBonus ?? 0) : 0;
  const limIsFx = limBonus > 0 && p.limitation.value != null;
  const limValue = p.limitation.kind === "X" ? (p.limitation.value ?? 0) + limBonus : null;
  // Lanceur = possède la compétence d'une voie de magie (source de vérité : MagicWay.skillId),
  // qu'elle soit native ou octroyée par effet (ex. Apprentie de Nyx → ostéomancie).
  const isCaster = cat.magicWays.some(
    (w) =>
      w.skillId != null &&
      (p.skills.some((s) => s.skillId === w.skillId) ||
        (mods?.grantedSkills ?? []).some((g) => g.skillId === w.skillId)),
  );
  const limLabel =
    p.limitation.kind === "special"
      ? "Limitation •"
      : p.limitation.kind === "X"
        ? `Limitation ${limValue ?? ""}`.trim() // X : on n'affiche que la valeur (corrigée)
        : `Limitation ${p.limitation.kind}`;
  const showLimitSource = () => {
    const src = sourceRefs("limit");
    onInfo({
      title: "Limitation",
      price: "",
      lines: [`Base ${p.limitation.value} + ${limBonus} = ${limValue}`],
      sources: src.length ? src : [{ label: "Effet", text: "Limitation modifiée par un effet." }],
    });
  };
  return (
    <div className="fe-statcard">
      <div className="fe-card">
        <SheetHeader
          icon={iconFor(cat, p)}
          name={p.name}
          level={p.level ? LEVEL[p.level] : undefined}
          cost={`${p.cost} Ko`}
        />
        <div className="fe-taglist">
          {limIsFx ? (
            <button
              className="fe-lim-fx"
              title="Limitation modifiée par un effet - voir la source"
              onClick={showLimitSource}
            >
              {limLabel}
            </button>
          ) : (
            <Tag>{limLabel}</Tag>
          )}
          {isCaster && <Tag tone="amber">Mage</Tag>}
          {grantedTraits.map((t) => (
            <span key={t} className="fe-fx-tag" title="Trait octroyé par un effet">
              {t}
            </span>
          ))}
        </div>
        {/* Stats groupées comme sur la carte : V P A C · T I, puis PA / PV / Stature à part. */}
        <div className="fe-stats">
          <div className="fe-statrow">
            {STATS_COMBAT.map(([k, label]) => statCell(k, label, p.stats[k]))}
            <span className="fe-statsep" aria-hidden />
            {STATS_SECONDARY.map(([k, label]) => statCell(k, label, p.stats[k]))}
          </div>
          <div className="fe-statrow fe-statrow--res">
            {statCell("pa", "PA", p.pa)}
            {statCell("pv", "PV", p.pv)}
            {statCell("stature", "Stature", p.stature)}
          </div>
          {mods?.mountAllonge != null && mods.mountAllonge !== 0 && (
            <div className="fe-statrow fe-statrow--allonge">
              <span className="fe-stat" title="Allonge apportée par la monture">
                <span className="k">Allonge</span>
                <span className="v is-fx">
                  {mods.mountAllonge > 0 ? "+" : ""}
                  {mods.mountAllonge}
                </span>
              </span>
            </div>
          )}
        </div>
        {/* Une seule armure : achetée/portée (remplace l'innée) sinon innée. */}
        <ArmorBlock
          armors={wornArmors && wornArmors.length > 0 ? wornArmors : p.armor ? [armorDisplay(p.armor)] : []}
        />
        <SkillChips
          skills={skillOrder.map((id) => {
            const a = skillAgg.get(id)!;
            const sk = cat.skills.find((x) => x.id === id);
            const fxVal = mods?.skillValues?.[id]; // valeur calculée (skill-count, ex. Seigneur de guerre)
            const vals = fxVal != null ? [fxVal] : [...a.nativeVals, ...a.grantedVals];
            const isFx = fxVal != null || grantedOnly.has(id) || a.grantedVals.length > 0;
            const label = `${sk?.keyword ?? id}${vals.length > 0 ? ` ${vals.join(" et ")}` : ""}`;
            return { key: id, label, fx: isFx, onClick: () => showSkill(id, label, isFx) };
          })}
        />
        <RulesBlock
          rules={p.rules}
          precisions={[...precisions, ...grantedPrecisions].map((s) => {
            const kw = cat.skills.find((x) => x.id === s.skillId)?.keyword ?? s.skillId;
            return { label: kw, precision: s.precision, onClick: () => showSkill(s.skillId, kw) };
          })}
        />
        {/* Dés de maîtrise : tout en bas de la carte (comme sur la carte officielle). */}
        {(p.masteryDice.length > 0 || (mods?.grantedMasteryDice?.length ?? 0) > 0) && (
          <div className="fe-mastery">
            <div className="fe-dice">
              {p.masteryDice.map((die, i) => (
                <MasteryDie key={i} domains={die} />
              ))}
              {mods?.grantedMasteryDice?.map((die, i) => (
                <span key={`g${i}`} className="fe-die-granted" title="Dé de maîtrise octroyé par un effet">
                  <MasteryDie domains={die} />
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
                {ameliorations.map((c) => {
                  const detail = () =>
                    onInfo({
                      title: c.name,
                      price: c.cost > 0 ? `${c.cost} Ko` : "gratuit",
                      lines: c.rulesText.map((r) => r.text),
                    });
                  // Amélioration empilable : stepper 0..niveau, coût = quantité × coût unitaire.
                  if (c.perLevelStack && onSetUpgradeCount) {
                    const max = p.level ?? 1;
                    const n = upgradeCounts?.[c.id] ?? (upgrades?.includes(c.id) ? 1 : 0);
                    return (
                      <div key={c.id} className="fe-check fe-upstep">
                        <span className="fe-stepper">
                          <span className="qty">{n}</span>
                          <span className="fe-stepbtns">
                            <button
                              className="fe-step"
                              onClick={() => onSetUpgradeCount(c.id, n + 1)}
                              disabled={n >= max}
                              aria-label="Ajouter"
                            >
                              +
                            </button>
                            <button
                              className="fe-step"
                              onClick={() => onSetUpgradeCount(c.id, n - 1)}
                              disabled={n <= 0}
                              aria-label="Retirer"
                            >
                              −
                            </button>
                          </span>
                        </span>
                        <button className="nm" onClick={detail} title="Voir le détail">
                          {c.name}
                        </button>
                        <span className="px">{n > 0 ? `+${n * c.cost} Ko` : `${c.cost} Ko/u`}</span>
                      </div>
                    );
                  }
                  return (
                    <label key={c.id} className="fe-check">
                      <input
                        type="checkbox"
                        checked={upgrades?.includes(c.id) ?? false}
                        onChange={() => onToggleUpgrade?.(c.id)}
                      />
                      <button className="nm" onClick={detail} title="Voir le détail">
                        {c.name}
                      </button>
                      <span className="px">
                        {c.cost > 0 ? `+${c.cost} Ko` : "gratuit"}
                        {c.shared ? " · partagée" : ""}
                      </span>
                    </label>
                  );
                })}
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
        {innateSpells.length > 0 && (
          <div>
            <SectionTitle>Magie</SectionTitle>
            <div className="fe-linked">
              {innateSpells.map((s) => (
                <button
                  key={s.id}
                  className="fe-linked-item"
                  onClick={() => onInfo(spellInfo(s, cat))}
                  title="Sort connu d'office - voir le détail"
                >
                  <span>{s.name}</span>
                  <span className="px">{s.cost ? `${s.cost} Ko` : "d'office"}</span>
                </button>
              ))}
            </div>
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
