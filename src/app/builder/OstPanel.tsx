import { useState } from "react";
import type { Catalog, ListDocument, Selector } from "@core";

type Prof = Catalog["profiles"][number];

/** Un profil correspond-il à une portée de carte (disponibilité) ? */
function scopeMatches(card: Catalog["specialCards"][number], p: Prof): boolean {
  return Boolean(
    card.scope.profileIds?.includes(p.id) ||
      (card.scope.trait && p.traits.includes(card.scope.trait)) ||
      (p.factionId && card.scope.factionIds?.includes(p.factionId)),
  );
}

/** Un profil correspond-il à un sélecteur (pour le décompte de la condition) ? */
function selMatches(sel: Selector, p: Prof): boolean {
  return Boolean(
    sel.all ||
      sel.profileIds?.includes(p.id) ||
      sel.traits?.some((t) => p.traits.includes(t)) ||
      (p.factionId && sel.factionIds?.includes(p.factionId)) ||
      (p.level != null && sel.levels?.includes(p.level)),
  );
}

/**
 * Panneau des cartes à portée Ost (sélection au niveau de la liste). Ne s'affiche que si au moins
 * une carte d'Ost est *disponible* (sa figurine-source est dans la liste). Chaque carte est repliée
 * par défaut (ligne compacte : flèche + nom + case) pour rester discrète ; on la déplie à la demande,
 * et une carte sélectionnée reste dépliée. La checklist de condition est dérivée de `activationCondition`
 * (profils nommés → cases ✓/☐, sinon libellé + « n / N »).
 */
export function OstPanel({
  cat,
  list,
  issues,
  onToggle,
}: {
  cat: Catalog;
  list: ListDocument;
  issues: { ruleId?: string }[];
  onToggle: (cardId: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const members = list.fersDeLance.flatMap((f) => f.members);
  const profiles = members
    .map((m) => cat.profiles.find((p) => p.id === m.profileId))
    .filter((p): p is Prof => Boolean(p));

  const available = cat.specialCards.filter(
    (c) => c.ostScope && profiles.some((p) => scopeMatches(c, p)),
  );
  if (available.length === 0) return null;

  const selected = new Set(list.ost?.cardIds ?? []);
  const isInvalid = (id: string) =>
    issues.some((i) => i.ruleId === `ost-card:${id}` || i.ruleId === `ost-card-unavailable:${id}`);

  return (
    <div className="bld-ost">
      <div className="bld-ost-head">
        <span className="bld-ost-sigil">❖</span> Ost - Cartes &amp; Pactes
      </div>
      <div className="bld-ost-cards">
        {available.map((card) => {
          const on = selected.has(card.id);
          const bad = on && isInvalid(card.id);
          const expanded = open.has(card.id);
          const cond = Array.isArray(card.activationCondition)
            ? card.activationCondition[0]
            : card.activationCondition;
          const required = cond?.countAtLeast ?? 1;
          const named = cond?.profileIds ?? [];
          const present = named.length
            ? named.filter((pid) => profiles.some((p) => p.id === pid)).length
            : cond
              ? profiles.filter((p) => selMatches(cond, p)).length
              : 0;
          const met = present >= required;

          return (
            <div
              key={card.id}
              className={`bld-ocard${on ? (bad ? " is-invalid" : " is-valid") : ""}${expanded ? " open" : ""}`}
            >
              <div className="bld-ocard-head">
                <button
                  type="button"
                  className="bld-ocard-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleOpen(card.id)}
                  title={expanded ? "Réduire" : "Déplier"}
                >
                  {expanded ? "▾" : "▸"}
                </button>
                <button type="button" className="bld-ocard-name" onClick={() => toggleOpen(card.id)}>
                  {card.name}
                </button>
                {on && (
                  <span className={`bld-ocard-flag ${bad ? "bad" : "ok"}`} title={bad ? "Condition non remplie" : "Active"}>
                    {bad ? "⚠" : "✓"}
                  </span>
                )}
                <label className="bld-ocard-switch" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="ui-check" checked={on} onChange={() => onToggle(card.id)} />
                  <span>{on ? "activé" : "activer"}</span>
                </label>
              </div>

              {expanded && (
                <div className="bld-ocard-body">
                  {card.rulesText.some((r) => r.text) && (
                    <p className="bld-ocard-eff">{card.rulesText.map((r) => r.text).filter(Boolean).join(" ")}</p>
                  )}

                  {bad && <p className="bld-ocard-err">⚠ Condition de composition de l'Ost non remplie.</p>}

                  {cond && (
                    <div className="bld-ocard-cond">
                      <div className="bld-ocard-condhead">
                        <span>
                          {named.length
                            ? `Requiert ${required} personnage(s) parmi`
                            : `Requiert ${required} figurine(s)`}
                        </span>
                        <span className={`bld-ocard-pill ${met ? "ok" : "bad"}`}>
                          {present} / {required} {met ? "✓" : "✗"}
                        </span>
                      </div>
                      {named.length > 0 && (
                        <div className="bld-ocard-members">
                          {named.map((pid) => {
                            const p = cat.profiles.find((x) => x.id === pid);
                            const inList = profiles.some((x) => x.id === pid);
                            return (
                              <span key={pid} className={`bld-ochip${inList ? " present" : ""}`}>
                                <span className="box">{inList ? "✓" : ""}</span>
                                {p?.name ?? pid}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
