import type { EmblemKind } from "./shared";
import fangs from "../../assets/factions/fangs.webp";
import kharns from "../../assets/factions/kharns.webp";
import gouns from "../../assets/factions/gouns.webp";
import kherops from "../../assets/factions/kherops.webp";
import tembos from "../../assets/factions/tembos.webp";
import guilde from "../../assets/factions/guilde.webp";
import affranchis from "../../assets/factions/affranchis.webp";

const CRESTS: Record<EmblemKind, string> = { fangs, kharns, gouns, kherops, tembos, guilde, affranchis };

/** FactionEmblem affiche les armoiries officielles de la faction, détourées par le halo `--faction-2` du parent. */
export function FactionEmblem({ kind, className }: { kind: EmblemKind; className?: string }) {
  return <img className={`kh-crest${className ? ` ${className}` : ""}`} src={CRESTS[kind]} alt="" draggable={false} />;
}
