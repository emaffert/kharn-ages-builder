import { specialCardsForProfile } from "@ui/explain";
import { Tag, STAT_FULL } from "@ui";
import { iconFor, type Catalog, type EquipmentCostRule, type MasteryDomain, type Profile } from "@core";
import { SectionTitle } from "./components";
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
  grantedSkills?: { skillId: string; value?: string | number }[];
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
};

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
}) {
  // Effets responsables d'une modification affichée (clé « stat:… » / « skill:… »).
  const sourceRefs = (key: string) => mods?.effectSources?.[key] ?? [];
  // Rend une caractéristique en tenant compte d'un éventuel modificateur d'effet.
  const fmtArmor = (n: number | undefined) => (n == null ? "-" : n > 0 ? `+${n}` : String(n));
  const statCell = (k: string, label: string, base: number | null | undefined) => {
    const d = mods?.statDeltas?.[k];
    const value = d != null ? (typeof base === "number" ? base : 0) + d : base;
    return (
      <span key={label} className="fe-stat">
        <span className="k">{label}</span>
        {d != null ? (
          <button
            className="v is-fx"
            title="Modifiée par un effet - voir la source"
            onClick={() => {
              const src = sourceRefs(`stat:${k}`);
              onInfo({
                title: STAT_FULL[k] ?? label,
                price: "",
                lines: [],
                sources: src.length ? src : [{ label: "Effet", text: "Caractéristique modifiée par un effet." }],
              });
            }}
          >
            {value ?? "-"}
          </button>
        ) : (
          <span className="v">{value ?? "-"}</span>
        )}
      </span>
    );
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
  // Lanceur = possède la compétence d'une voie de magie (source de vérité : MagicWay.skillId).
  const isCaster = cat.magicWays.some(
    (w) => w.skillId != null && p.skills.some((s) => s.skillId === w.skillId),
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
        <div className="fe-card-head">
          <div className="fe-headmain">
            {iconFor(cat, p) && <img className="fe-portrait" src={iconFor(cat, p)} alt="" />}
            <h3 className="fe-card-name">
              {p.name}
              {p.level ? <span className="lvl">{LEVEL[p.level]}</span> : null}
            </h3>
          </div>
          <span className="fe-cost-chip">{p.cost} Ko</span>
        </div>
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
        </div>
        {p.armor && (
          <div
            className="fe-armor"
            title="Armure - protection en cas d'échec / seuil / protection en cas de réussite"
          >
            <span className="fe-armor-lab">🛡 Armure</span>
            <span className="fe-armor-vals">
              {fmtArmor(p.armor.protectionEchec)} <i>/</i> {p.armor.seuil ?? "-"}{" "}
              <i>/</i> {fmtArmor(p.armor.protectionReussite)}
            </span>
            {p.armor.durability != null && (
              <span className="fe-armor-dur">durabilité {p.armor.durability}</span>
            )}
          </div>
        )}
        <div className="fe-skills">
          {skillOrder.map((id) => {
            const a = skillAgg.get(id)!;
            const sk = cat.skills.find((x) => x.id === id);
            const fxVal = mods?.skillValues?.[id]; // valeur calculée (skill-count, ex. Seigneur de guerre)
            const vals = fxVal != null ? [fxVal] : [...a.nativeVals, ...a.grantedVals];
            const isFx = fxVal != null || grantedOnly.has(id) || a.grantedVals.length > 0;
            const label = `${sk?.keyword ?? id}${vals.length > 0 ? ` ${vals.join(" et ")}` : ""}`;
            return (
              <button
                key={id}
                className={`fe-skill${isFx ? " is-fx" : ""}`}
                onClick={() => showSkill(id, label, isFx)}
                title={isFx ? "Compétence ou valeur modifiée par un effet" : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(p.rules.length > 0 || precisions.length > 0) && (
          <div className="fe-rules">
            {p.rules.map((r, i) => (
              <div key={i}>
                {r.label && <b>{r.label}{r.text ? " : " : ""}</b>}
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
