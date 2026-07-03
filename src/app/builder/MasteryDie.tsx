import type { MasteryDomain } from "@core";
import vide from "../../assets/maitrise/vide.png";
import offensive from "../../assets/maitrise/offensive.png";
import defensive from "../../assets/maitrise/defensive.png";
import objectif from "../../assets/maitrise/objectif.png";
import tir from "../../assets/maitrise/tir.png";
import esoterique from "../../assets/maitrise/esoterique.png";

/**
 * Un dé de maîtrise, façon carte officielle : le pentagone `vide.png` en fond et chaque domaine
 * dans sa section. Les domaines *portés* par le dé sont pleins, les autres grisés.
 *
 * Assets N&B (encre noire sur transparent). En thème clair ils sont utilisés tels quels ; en thème
 * sombre, `.km-die` est inversé/réchauffé en CSS (`filter`) pour ressortir en teinte os sur le fond.
 * Icônes à leur taille native (échelle du dé) et calées par registration alpha : `left`/`top`
 * (coin haut-gauche) et `width` en % du dé (base 1147×1063), hauteur = aspect natif.
 */

type Face = { domain: MasteryDomain; label: string; src: string; left: number; top: number; width: number };

const FACES: Face[] = [
  { domain: "offensive", label: "Offensive", src: offensive, left: 22.84, top: 9.41, width: 30.69 },
  { domain: "defensive", label: "Défensive", src: defensive, left: 54.32, top: 8.84, width: 29.99 },
  { domain: "objectif", label: "Objectif", src: objectif, left: 57.54, top: 39.32, width: 27.72 },
  { domain: "tir", label: "Tir", src: tir, left: 37.23, top: 51.93, width: 34.0 },
  { domain: "esoterique", label: "Ésotérique", src: esoterique, left: 19.7, top: 38.19, width: 29.64 },
];

export function MasteryDie({ domains }: { domains: MasteryDomain[] }) {
  const available = new Set(domains);
  const on = FACES.filter((f) => available.has(f.domain)).map((f) => f.label);
  return (
    <span className="km-die" role="img" aria-label={`Dé de maîtrise : ${on.join(", ")}`}>
      <img className="km-die-bg" src={vide} alt="" />
      {FACES.map((f) => (
        <img
          key={f.domain}
          className="km-die-icon"
          data-on={available.has(f.domain)}
          src={f.src}
          alt=""
          title={f.label}
          style={{ left: `${f.left}%`, top: `${f.top}%`, width: `${f.width}%` }}
        />
      ))}
    </span>
  );
}
