import { useState } from "react";
import { Button, Dialog } from "@ui";
import changelogSource from "../../../CHANGELOG.md?raw";
import { entryKey, parseEntries, unseenEntries } from "./changelog";

/**
 * Annonce des nouveautés à l'ouverture de l'administration, une fois par version.
 *
 * La source est le `CHANGELOG.md` du dépôt, embarqué au build : un seul endroit à tenir à jour, et
 * ce qui est annoncé est exactement ce qui a été écrit pour les joueurs.
 *
 * Deux règles, tirées de ce qui manquait aux versions précédentes :
 *
 * - le déclencheur est la **signature de la dernière entrée lue**, pas la façon dont on est arrivé
 *   sur la nouvelle version. Bouton « Recharger », rafraîchissement du navigateur ou simple visite
 *   plus tard donnent le même résultat ;
 * - on montre **tout ce qui n'a pas été lu**, et pas seulement la dernière entrée : sauter deux
 *   versions ne doit pas en escamoter une.
 */
const SEEN_KEY = "kharn-changelog-vu";

const readSeen = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

export function WhatsNew() {
  const entries = parseEntries(changelogSource);
  // Figé au montage : refermer la modale ne doit pas recalculer une liste devenue vide.
  const [unseen] = useState(() => unseenEntries(entries, readSeen()));
  const [open, setOpen] = useState(unseen.length > 0);

  const close = () => {
    setOpen(false);
    try {
      // On retient la plus récente : tout ce qui la précède est lu par construction.
      if (entries[0]) localStorage.setItem(SEEN_KEY, entryKey(entries[0]));
    } catch {
      /* mode privé : la modale reviendra, ce n'est pas bloquant */
    }
  };

  if (unseen.length === 0) return null;
  const plusieurs = unseen.length > 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      size="lg"
      title={plusieurs ? "Nouveautés depuis votre dernière visite" : "Nouveautés de cette version"}
      description={plusieurs ? `${unseen.length} versions` : unseen[0].date}
      footer={<Button onClick={close}>J'ai lu</Button>}
    >
      <div className="adm-whatsnew">
        {unseen.map((entry) => (
          <article key={entry.date}>
            {plusieurs && <h2 className="adm-whatsnew-date">{entry.date}</h2>}
            {entry.sections.map((s) => (
              <section key={s.title}>
                {s.title && <h3>{s.title}</h3>}
                <ul>
                  {s.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </div>
    </Dialog>
  );
}
