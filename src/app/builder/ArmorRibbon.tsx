/**
 * Protection d'une armure, rendue comme sur les cartes du jeu : le **seuil** vit à l'intérieur d'une
 * cuirasse, encadré par la protection en cas d'échec (à gauche) et en cas de réussite (à droite).
 *
 * `Arm.-2/6/-3` ne disait pas quel nombre était lequel ; le dispositif le dit de lui-même, et c'est
 * celui que le joueur a déjà sous les yeux sur sa carte imprimée.
 */
export function ArmorRibbon({
  armor,
}: {
  armor: { protectionEchec?: number; seuil?: number; protectionReussite?: number };
}) {
  const n = (v?: number) => (v == null ? "-" : String(v));
  return (
    <span
      className="mdl-ribbon"
      aria-label={`Protection : ${n(armor.protectionEchec)} en cas d'échec, seuil ${n(armor.seuil)}, ${n(armor.protectionReussite)} en cas de réussite`}
    >
      <b className="side" aria-hidden="true">
        {n(armor.protectionEchec)}
      </b>
      <span className="plate" aria-hidden="true">
        <svg viewBox="0 0 42 46" aria-hidden="true" focusable="false">
          <path
            d="M21 1 C15 1 10 2.6 6 5.4 L4 7 L6.6 13.4 C6.2 16 6 18.6 6 21.2 C6 30.6 11.6 39.4 21 45 C30.4 39.4 36 30.6 36 21.2 C36 18.6 35.8 16 35.4 13.4 L38 7 L36 5.4 C32 2.6 27 1 21 1 Z"
            fill="color-mix(in srgb, var(--bone) 13%, transparent)"
            stroke="color-mix(in srgb, var(--bone) 34%, transparent)"
            strokeWidth="1.4"
          />
        </svg>
        <i>{n(armor.seuil)}</i>
      </span>
      <b className="side" aria-hidden="true">
        {n(armor.protectionReussite)}
      </b>
    </span>
  );
}
