import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Button } from "@ui";

const FRAME = 300; // taille d'édition (px)
const OUT = 256; // résolution de l'icône exportée (px)

type Pan = { x: number; y: number };

/**
 * Éditeur d'icône : charge une image de référence (fichier ou `initialSrc`),
 * la déplace/zoome derrière un cadre carré, et exporte le recadrage en data-URI.
 */
export function IconEditor({
  initialSrc,
  onSave,
  onClose,
}: {
  initialSrc?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | undefined>(initialSrc);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // (re)charge l'image quand la source change → mémorise ses dimensions naturelles.
  useEffect(() => {
    if (!src) return;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      imgRef.current = el;
      setNat({ w: el.naturalWidth, h: el.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError(null);
    };
    el.onerror = () => {
      imgRef.current = null;
      setNat(null);
      setError("Image de référence introuvable — charge un fichier.");
    };
    el.src = src;
  }, [src]);

  // Géométrie : « cover » du cadre à zoom = 1, puis mise à l'échelle.
  const base = nat ? FRAME / Math.min(nat.w, nat.h) : 1;
  const s = base * zoom;
  const dw = nat ? nat.w * s : 0;
  const dh = nat ? nat.h * s : 0;
  const maxX = Math.max(0, (dw - FRAME) / 2);
  const maxY = Math.max(0, (dh - FRAME) / 2);
  const clamp = useCallback(
    (p: Pan): Pan => ({
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    }),
    [maxX, maxY],
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!nat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setPan(clamp({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  // Change le zoom en re-bornant le pan avec la géométrie du nouveau zoom (évite un effet de reclamp).
  const setZoomClamped = useCallback(
    (z: number) => {
      const nz = Math.max(1, Math.min(6, z));
      setZoom(nz);
      if (!nat) return;
      const s2 = (FRAME / Math.min(nat.w, nat.h)) * nz;
      const mx = Math.max(0, (nat.w * s2 - FRAME) / 2);
      const my = Math.max(0, (nat.h * s2 - FRAME) / 2);
      setPan((p) => ({ x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }));
    },
    [nat],
  );
  const onWheel = (e: ReactWheelEvent) => {
    if (!nat) return;
    setZoomClamped(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  };

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setSrc(typeof r.result === "string" ? r.result : undefined);
    r.readAsDataURL(f);
  };

  const save = () => {
    const el = imgRef.current;
    if (!el || !nat) return;
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const k = OUT / FRAME;
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, OUT, OUT);
    const left = (FRAME / 2 + pan.x - dw / 2) * k;
    const top = (FRAME / 2 + pan.y - dh / 2) * k;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(el, left, top, dw * k, dh * k);
    onSave(c.toDataURL("image/jpeg", 0.85));
  };

  // rendu du cadre à une taille arbitraire (édition + aperçus), même géométrie.
  const framed = (size: number, interactive = false) => {
    const f = size / FRAME;
    return (
      <div
        className="adm-frame relative shrink-0 overflow-hidden"
        style={{ width: size, height: size, borderRadius: size * 0.09, cursor: interactive && nat ? "grab" : "default" }}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onWheel={interactive ? onWheel : undefined}
      >
        {src && nat && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              width: dw * f,
              height: dh * f,
              left: (FRAME / 2 + pan.x) * f - (dw * f) / 2,
              top: (FRAME / 2 + pan.y) * f - (dh * f) / 2,
              maxWidth: "none",
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="adm-scrim fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="adm-modal flex max-w-[720px] gap-5 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cadre d'édition */}
        <div className="flex flex-col items-center gap-3">
          {framed(FRAME, true)}
          <div className="flex w-full items-center gap-2">
            <span className="adm-faint text-xs">Zoom</span>
            <input
              type="range"
              min={1}
              max={6}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoomClamped(Number(e.target.value))}
              className="adm-range flex-1"
              disabled={!nat}
            />
          </div>
          <p className="adm-faint text-center text-xs">Glisse pour déplacer · molette ou curseur pour zoomer</p>
        </div>

        {/* Colonne latérale : aperçus + actions */}
        <div className="flex w-56 flex-col gap-4">
          <div>
            <p className="adm-section-title mb-2">Aperçu réel</p>
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-center gap-1">
                {framed(64)}
                <span className="adm-faint text-[10px]">vignette 64</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {framed(84)}
                <span className="adm-faint text-[10px]">modale 84</span>
              </div>
            </div>
          </div>

          {error && <p className="adm-accent text-xs">{error}</p>}

          <label className="adm-btn-soft cursor-pointer px-3 py-2 text-center text-sm">
            Charger une image…
            <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
          </label>

          <div className="mt-auto flex flex-col gap-2">
            <Button variant="primary" onClick={save} disabled={!nat}>
              Enregistrer l'icône
            </Button>
            <Button onClick={onClose}>Annuler</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
