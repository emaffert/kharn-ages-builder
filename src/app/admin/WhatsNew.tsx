import { useState } from "react";
import { Button, Dialog } from "@ui";
import changelogSource from "../../../CHANGELOG.md?raw";
import { consumeJustUpdated } from "../updates";
import { parseLatestEntry } from "./changelog";

/**
 * Annonce des nouveautés, à l'ouverture de l'administration qui suit une mise à jour du site.
 *
 * La source est le `CHANGELOG.md` du dépôt, embarqué au build : il n'y a donc qu'un seul endroit à
 * tenir à jour, et ce qui est annoncé est exactement ce qui a été écrit pour les joueurs.
 */

export function WhatsNew() {
  // Consommé une seule fois au montage : rouvrir l'admin dans la même session ne le redemande pas.
  const [open, setOpen] = useState(consumeJustUpdated);
  const entry = parseLatestEntry(changelogSource);
  if (!entry) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="lg"
      title="Nouveautés de cette version"
      description={entry.date}
      footer={<Button onClick={() => setOpen(false)}>J'ai lu</Button>}
    >
      <div className="adm-whatsnew">
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
      </div>
    </Dialog>
  );
}
