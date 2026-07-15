import { mountLabel, type Catalog, type Profile, type ProfileInstance } from "@core";
import { TrashIcon } from "./icons";
import { MountPurchaseSummary } from "./MountPurchaseSummary";
import type { ItemInfo } from "./shared";

/**
 * Sous-ligne de la monture, rendue comme une figurine rattachée mais nichée dans le cavalier.
 * `x.inst.mount` est supposé présent (la sous-ligne n'est rendue que pour une figurine montée).
 */
export function MountSubline({
  x,
  cat,
  mountCost,
  onOpen,
  onRemove,
  onPick,
}: {
  x: { inst: ProfileInstance; p: Profile };
  cat: Catalog;
  /** Coût de la monture (séparé du cavalier dans l'évaluation). */
  mountCost: number;
  onOpen: () => void;
  onRemove: () => void;
  onPick: (info: ItemInfo) => void;
}) {
  const mid = x.inst.mount!.mountId;
  const mount = cat.mounts.find((m) => m.id === mid);
  const mType = cat.mountTypes.find((t) => t.id === mount?.typeId);
  const mIcon = mount?.icon ?? (mType?.cardImage ? cat.icons?.[mType.cardImage] : undefined);
  return (
    <div className="bld-unit is-attached">
      <div
        className="bld-unit-main"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, input, a")) return;
          onOpen();
        }}
      >
        <div className="bld-thumb sm">
          {mIcon ? <img className="bld-thumb-img" src={mIcon} alt="" /> : <span className="lvl">🐎</span>}
        </div>
        <div className="bld-uinfo">
          <div className="bld-uname">
            <button className="nm" onClick={onOpen}>
              {mountLabel(cat, mid)}
            </button>
            <span className="lvltag">Monture</span>
          </div>
        </div>
        <div className="bld-ucost">
          {mountCost} <span className="ko">Ko</span>
        </div>
        <div className="bld-uactions">
          <button className="bld-icon danger" title="Retirer la monture" onClick={onRemove}>
            <TrashIcon />
          </button>
        </div>
      </div>
      <MountPurchaseSummary
        cat={cat}
        factionId={x.p.factionId}
        mount={x.inst.mount!}
        mountOptionIds={x.inst.mountOptionIds}
        onPick={onPick}
      />
    </div>
  );
}
