#!/usr/bin/env python3
"""Sortie des icônes du catalogue : data-URI JPEG -> fichiers WebP adressés par contenu.

Premier des deux temps de la migration (cf. `scripts/apply-icon-map.mjs` pour le second) :

1. ce script lit `src/data/catalog.json`, ré-encode chaque portrait en WebP, écrit les fichiers
   dans `src/assets/icons/` et produit la table de correspondance `scripts/.icons-map.json` ;
2. le script Node applique cette table au catalogue, en réécrivant le JSON exactement comme le
   fait l'app - c'est pourquoi la réécriture n'est PAS faite ici : Python et JavaScript
   n'échappent pas les chaînes de la même façon, et un écart produirait un diff illisible.

Idempotent : une valeur qui est déjà une référence `<hash>.webp` est laissée telle quelle, on peut
donc relancer sans rien casser.

Dépendance : Pillow (`pip install Pillow`). Script de migration ponctuel, conservé pour la trace.

Usage : python3 scripts/icons_to_webp.py [--quality 78] [--dry-run]
"""

import argparse
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "src" / "data" / "catalog.json"
ICON_DIR = ROOT / "src" / "assets" / "icons"
MAP_FILE = ROOT / "scripts" / ".icons-map.json"

# Doit rester d'accord avec `iconName` (src/lib/icons.ts) : 16 hex du SHA-256, extension .webp.
NAME_RE = re.compile(r"^[0-9a-f]{16}\.webp$")


def icon_name(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16] + ".webp"


def to_webp(data_uri: str, quality: int) -> bytes:
    """Ré-encode une data-URI en WebP. `method=6` : encodage lent, meilleure compression."""
    raw = base64.b64decode(data_uri.split(",", 1)[1])
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    out = io.BytesIO()
    image.save(out, "WEBP", quality=quality, method=6)
    return out.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quality", type=int, default=78, help="qualité WebP (défaut : 78)")
    ap.add_argument("--dry-run", action="store_true", help="mesure sans rien écrire")
    args = ap.parse_args()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))

    # Chaque emplacement du schéma qui accepte une icône : la table partagée, puis les deux
    # dérogations par niveau. Repérées par leur clé naturelle, que le script Node saura retrouver.
    sources: list[tuple[str, str, str]] = []  # (section, clé, valeur)
    for card_image, value in (catalog.get("icons") or {}).items():
        sources.append(("icons", card_image, value))
    for profile in catalog.get("profiles", []):
        if profile.get("icon"):
            sources.append(("profiles", profile["id"], profile["icon"]))
    for mount in catalog.get("mounts", []):
        if mount.get("icon"):
            sources.append(("mounts", mount["id"], mount["icon"]))

    mapping: dict[str, dict[str, str]] = {"icons": {}, "profiles": {}, "mounts": {}}
    written: dict[str, bytes] = {}
    before = after = 0
    skipped = 0

    for section, key, value in sources:
        if NAME_RE.match(value):
            skipped += 1
            continue
        if not value.startswith("data:"):
            print(f"  ! {section}/{key} : valeur inattendue, ignorée ({value[:40]}…)", file=sys.stderr)
            continue
        webp = to_webp(value, args.quality)
        name = icon_name(webp)
        mapping[section][key] = name
        # Deux emplacements au contenu identique retombent sur le même nom : un seul fichier.
        if name not in written:
            written[name] = webp
            after += len(webp)
        before += len(base64.b64decode(value.split(",", 1)[1]))

    converted = sum(len(m) for m in mapping.values())
    print(f"{converted} référence(s) converties vers {len(written)} fichier(s) uniques"
          f"{f', {skipped} déjà migrée(s)' if skipped else ''}")
    if before:
        print(f"JPEG {before / 1e6:.2f} Mo -> WebP q{args.quality} {after / 1e6:.2f} Mo "
              f"(-{100 - 100 * after / before:.0f} %)")

    if args.dry_run:
        print("--dry-run : rien écrit.")
        return 0

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for name, data in written.items():
        (ICON_DIR / name).write_bytes(data)
    MAP_FILE.write_text(json.dumps(mapping, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Fichiers : {ICON_DIR.relative_to(ROOT)}/  ·  table : {MAP_FILE.relative_to(ROOT)}")
    print("Étape suivante : node scripts/apply-icon-map.mjs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
