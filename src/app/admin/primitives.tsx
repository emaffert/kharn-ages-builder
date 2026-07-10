import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Tag } from "@ui";
import type { FieldValue } from "../useCatalogStore";
import { INPUT } from "./shared";
import offensive from "../../assets/maitrise/offensive.png";
import defensive from "../../assets/maitrise/defensive.png";
import objectif from "../../assets/maitrise/objectif.png";
import tir from "../../assets/maitrise/tir.png";
import esoterique from "../../assets/maitrise/esoterique.png";

/** Composants de présentation réutilisables de l'admin (stylés sur admin.css). */

/** Vrais symboles des 5 domaines de maîtrise (mêmes assets que le dé des fiches). */
const DOMAIN_ICONS: Record<string, string> = { offensive, defensive, objectif, tir, esoterique };

/**
 * Icône d'un domaine de maîtrise (asset N&B). Recoloré par le `filter` de thème `--km-tune`
 * (comme le dé des fiches) : encre en clair, os en sombre. L'état actif/inactif dans un dé est
 * rendu par l'opacité (cf. `.adm-dice .adm-domain-icon` dans admin.css).
 */
export function DomainIcon({ domain, className = "h-4 w-4" }: { domain: string; className?: string }) {
  const src = DOMAIN_ICONS[domain];
  if (!src) return null;
  return <img src={src} alt={domain} className={`adm-domain-icon ${className}`} />;
}

/** Pastille de règle - réutilise `@ui` Tag (mêmes tons que le builder). */
export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const map: Record<string, "neutral" | "warn" | "amber" | "moss"> = {
    slate: "neutral",
    red: "warn",
    amber: "amber",
    green: "moss",
    violet: "neutral",
  };
  return <Tag tone={map[tone] ?? "neutral"}>{children}</Tag>;
}

// ── Glyphes de section (orientation) ─────────────────────────────────────────
// Petit jeu de traits ; sert de marqueur de section ET d'icône dans le sommaire.
// Clé stable (string) car le sommaire lit `data-icon` sur le DOM des sections.

const GLYPH_PATHS: Record<string, ReactNode> = {
  identity: (<><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  stats: (<><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>),
  skills: (<path d="M12 3l2.5 5.5L20 9.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1z" />),
  verbatim: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h9M7 12h9M7 16h5" /></>),
  dice: (<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>),
  armor: (<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />),
  equipment: (<><path d="M4 20l9-9M14 4l6 6-3 1-4-4z" /><path d="M11 13l-2 2 3 3 2-2" /></>),
  traits: (<><path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></>),
  notes: (<><path d="M6 3h9l5 5v13H6z" /><path d="M15 3v5h5" /><path d="M9 13h6M9 17h4" /></>),
  effects: (<path d="M13 2L5 13h6l-1 9 8-11h-6z" />),
  constraints: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M4 18l5-5 4 4 3-3 4 4" /></>),
  type: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  scope: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
  cost: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h3.5a1.5 1.5 0 0 1 0 3H10" /></>),
  magic: (<><path d="M5 19l9-9M13 4l2 2M17 8l2 2" /><path d="M15 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></>),
  mount: (<path d="M4 18c1-5 4-8 9-8h5l-2 4h-3c-3 0-5 2-6 4z" />),
  trash: (<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />),
  default: (<circle cx="12" cy="12" r="7" />),
};

/** Glyphe SVG monochrome (hérite de `currentColor`). `name` = clé de GLYPH_PATHS. */
export function Glyph({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {GLYPH_PATHS[name] ?? GLYPH_PATHS.default}
    </svg>
  );
}

/**
 * Section en bloc (fond, filet, en-tête à marqueur + glyphe). Rétro-compatible : la plupart des
 * pages ne passent que `title` + enfants. `icon` choisit le glyphe (défaut générique), `note` déplace
 * les anciennes parenthèses de titre en sous-titre, `meta` accueille compteurs/actions à droite.
 * `id` + `data-*` alimentent le sommaire ancré (cf. SectionNav) ; à défaut l'id est dérivé du titre.
 */
export function Section({
  title,
  icon = "default",
  note,
  meta,
  id,
  children,
}: {
  title: string;
  icon?: string;
  note?: ReactNode;
  meta?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="adm-sec" id={id ?? slugId(title)} data-title={title} data-icon={icon}>
      <div className="adm-sec-head">
        <span className="adm-sec-marker"><Glyph name={icon} /></span>
        <div className="adm-sec-heading">
          <h3 className="adm-sec-title">{title}</h3>
          {note && <p className="adm-sec-note">{note}</p>}
        </div>
        {meta && <div className="adm-sec-meta">{meta}</div>}
      </div>
      <div className="adm-sec-body">{children}</div>
    </section>
  );
}

/** id stable dérivé d'un titre (pour l'ancre du sommaire quand la page n'en fournit pas). */
function slugId(title: string): string {
  return (
    "sec-" +
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40)
  );
}

/**
 * Sommaire ancré : dérivé du DOM des sections rendues (`.adm-sec[data-title]`) dans `targetRef`.
 * Robuste aux sections conditionnelles et au changement d'entité (MutationObserver). Surligne la
 * section courante par IntersectionObserver, calé sur le conteneur de défilement `.adm-scroll`.
 */
export function SectionNav({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<{ id: string; title: string; icon: string }[]>([]);
  const [active, setActive] = useState<string>("");
  const sigRef = useRef<string>("");

  useEffect(() => {
    const root = targetRef.current;
    if (!root) return;
    const scroll = root.closest<HTMLElement>(".adm-scroll");
    let io: IntersectionObserver | null = null;

    const rebuild = () => {
      const secs = Array.from(root.querySelectorAll<HTMLElement>(".adm-sec"));
      const sig = secs.map((s) => s.id).join("|");
      if (sig === sigRef.current) return; // structure inchangée : on garde l'IO en place
      sigRef.current = sig;
      setItems(secs.map((s) => ({ id: s.id, title: s.dataset.title ?? "", icon: s.dataset.icon ?? "default" })));
      io?.disconnect();
      if (typeof IntersectionObserver === "undefined") return; // pas de scroll-spy hors navigateur (tests, SSR)
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).id);
        },
        { root: scroll ?? null, rootMargin: "-8% 0px -70% 0px", threshold: 0 },
      );
      secs.forEach((s) => io!.observe(s));
    };

    rebuild();
    const mo = new MutationObserver(rebuild);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io?.disconnect();
      mo.disconnect();
    };
  }, [targetRef]);

  if (items.length < 2) return null;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <nav className="adm-toc" aria-label="Sommaire">
      <div className="adm-toc-title">Sommaire</div>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => go(it.id)}
          className={`adm-toc-link ${active === it.id ? "adm-toc-link--on" : ""}`}
        >
          <Glyph name={it.icon} className="adm-toc-glyph" />
          <span>{it.title}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * Squelette d'une page de détail : sommaire ancré + colonne de détail (en-tête + sections dans un
 * **ordre imposé** : identité → corps spécifique → verbatim → notes → applicabilité → contraintes →
 * effets → média). Chaque page ne fournit que les emplacements pertinents.
 */
export function DetailPage({
  header,
  body,
  verbatim,
  notes,
  applicability,
  constraints,
  effects,
  media,
}: {
  header: ReactNode;
  body?: ReactNode;
  verbatim?: ReactNode;
  notes?: ReactNode;
  applicability?: ReactNode;
  constraints?: ReactNode;
  effects?: ReactNode;
  media?: ReactNode;
}) {
  const detailRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="adm-workspace-inner">
      <SectionNav targetRef={detailRef} />
      <div className="adm-detail" ref={detailRef}>
        {header}
        {body}
        {verbatim}
        {notes}
        {applicability}
        {constraints}
        {effects}
        {media}
      </div>
    </div>
  );
}

/**
 * En-tête d'entité mutualisé : nom (Cinzel), coût optionnel (Ko doré), suppression, méta optionnelle
 * (id, faction, niveau…). `extra` s'insère entre le nom et le coût (ex. badge de niveau d'une monture).
 */
export function DetailHeader({
  name,
  onName,
  namePlaceholder,
  cost,
  onCost,
  costPlaceholder,
  onRemove,
  removeTitle,
  sub,
  extra,
}: {
  name: string;
  onName: (v: string) => void;
  namePlaceholder?: string;
  cost?: number | null;
  onCost?: (v: number | null) => void;
  costPlaceholder?: string;
  onRemove?: () => void;
  removeTitle?: string;
  sub?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <header className="adm-entity-head">
      <div className="adm-entity-topline">
        <input
          className="adm-name"
          value={name}
          placeholder={namePlaceholder}
          onChange={(e) => onName(e.target.value)}
        />
        {extra}
        {onCost && (
          <label className="adm-costfield">
            <span className="coin" />
            <input
              type="number"
              value={cost ?? ""}
              placeholder={costPlaceholder}
              onChange={(e) => onCost(e.target.value === "" ? null : Number(e.target.value))}
            />
            <span className="unit">Ko</span>
          </label>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} title={removeTitle} className="adm-del">
            <Glyph name="trash" />
          </button>
        )}
      </div>
      {sub && <div className="adm-entity-sub">{sub}</div>}
    </header>
  );
}

/** Champ étiqueté : label lisible au-dessus du contrôle (remplace les « text-xs adm-faint » minuscules). */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`adm-field ${className}`}>
      <span className="adm-field-label">
        {label}
        {hint && <span className="adm-field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Groupe étiqueté : un label (+ hint) au-dessus d'un contenu libre qui n'est pas un simple champ
 * (puces, sous-champs, tableau de coûts…). Mutualise le `<div><span.adm-field-label>…</span>…</div>`
 * répété sur presque toutes les pages.
 */
export function FieldGroup({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`adm-fieldgroup ${className}`}>
      <span className="adm-field-label">
        {label}
        {hint && <span className="adm-field-hint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/** Champ numérique étiqueté (input plein, pas la pastille EditableNumber). Mutualise `num()`/inputs inline. */
export function NumberField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  className = "w-24",
}: {
  label: string;
  hint?: string;
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={INPUT}
      />
    </Field>
  );
}

/** En-tête des pages-tables (Voies de magie, Réglages), sans sommaire ancré. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="adm-page-head">
      <h2 className="adm-page-title">{title}</h2>
      {subtitle && <p className="adm-page-sub">{subtitle}</p>}
    </header>
  );
}

/** Section « Image de la carte » canonique (même intitulé, hint et champ partout). */
export function CardImageSection({
  value,
  onChange,
  hint = "Chemin de la carte affichée dans l'aperçu.",
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Section title="Image de la carte" icon="image">
      <Field label="Emplacement du fichier" hint={hint}>
        <input value={value} placeholder="cards/..." onChange={(e) => onChange(e.target.value)} className={`${INPUT} max-w-md`} />
      </Field>
    </Section>
  );
}

/** Case à cocher étiquetée en bloc : libellé + un seul hint cohérent en dessous, cliquable sur tout. */
export function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="adm-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="adm-check-label">{label}</span>
        {hint && <span className="adm-check-hint">{hint}</span>}
      </span>
    </label>
  );
}

/** Multi-sélection en puces : remplace les longues listes de checkbox (traits, domaines, catégories…). */
export function ChipMultiSelect<T extends string>({
  options,
  selected,
  onToggle,
  renderIcon,
}: {
  options: { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  renderIcon?: (v: T) => ReactNode;
}) {
  return (
    <div className="adm-chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="adm-mchip"
          aria-pressed={selected.includes(o.value)}
          onClick={() => onToggle(o.value)}
        >
          {renderIcon?.(o.value)}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="adm-add">
      {children}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Supprimer" className="adm-x">
      ✕
    </button>
  );
}

export function FlagButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Lecture incertaine (cliquer pour valider)" : "Marquer comme « à vérifier »"}
      className={`leading-none transition-opacity ${
        active ? "adm-flag adm-flag--on" : "adm-flag opacity-0 group-hover:opacity-100"
      }`}
    >
      ⚠
    </button>
  );
}

export function EditableNumber({
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
  /** Bouton « à vérifier » par champ. Absent → pas de bouton (le flag est géré ailleurs, ex. groupé). */
  onToggle?: () => void;
}) {
  return (
    <label className={`group adm-num ${unverified ? "adm-num--warn" : ""}`}>
      <span className="adm-num-label">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {onToggle && <FlagButton active={unverified} onClick={onToggle} />}
    </label>
  );
}

export function RuleCard({
  human,
  sourceText,
  badges,
}: {
  human: string;
  sourceText: string;
  badges: ReactNode;
}) {
  return (
    <div className="adm-card p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
      <p className="adm-fg text-sm">{human}</p>
      <p className="adm-quote pl-2 text-xs italic">« {sourceText} »</p>
    </div>
  );
}

export type ComboOption = { value: string; label: string; hint?: string };

/**
 * Menu déroulant cherchable générique : choisir une entrée dans une liste (compétence, profil,
 * modèle, voie de sort…) qui s'étoffe. Même comportement que le choix d'équipement.
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder = "Rechercher…",
  className = "flex-1",
}: {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const current = options.find((o) => o.value === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (
    q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint?.toLowerCase().includes(q) ?? false))
      : options
  ).slice(0, 12);
  return (
    <div className={`adm-combo-wrap ${className}`}>
      <input
        className={`${INPUT} w-full`}
        value={open ? query : current?.label ?? value}
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 && (
        <ul className="adm-combo">
          {matches.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className="adm-combo-item"
                onMouseDown={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.hint && <span className="adm-faint text-xs">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
