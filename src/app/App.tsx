import { Suspense, lazy, useMemo, useState } from "react";
import { localCatalogDivergesFromFile } from "@data";
import { ListBuilder } from "./ListBuilder";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";

// L'écran Admin (éditeur de catalogue, volumineux) n'est pas sur le chemin critique du
// constructeur : on le charge à la demande pour alléger le bundle initial.
const AdminCatalog = lazy(() => import("./AdminCatalog").then((m) => ({ default: m.AdminCatalog })));

export function App() {
  const [view, setView] = useState<"builder" | "admin">("builder");
  const [theme, setTheme] = useTheme();
  // Garde-fou dev : signale qu'une copie locale du catalogue masque `catalog.json`.
  // Recalculé au changement de vue (ex. après un Réinit. dans l'Admin) — `view` est volontaire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const staleCatalog = useMemo(() => import.meta.env.DEV && localCatalogDivergesFromFile(), [view]);
  return (
    <div className="kh-shell flex h-screen flex-col">
      <nav className="kh-topbar flex items-center gap-2 px-4 py-1.5">
        <span className="kh-brand mr-3 text-sm font-bold">Khârn-Âges</span>
        <button
          onClick={() => setView("builder")}
          data-on={view === "builder"}
          className="kh-tab rounded px-3 py-1 text-sm font-medium"
        >
          Constructeur
        </button>
        <button
          onClick={() => setView("admin")}
          data-on={view === "admin"}
          className="kh-tab rounded px-3 py-1 text-sm font-medium"
        >
          Admin
        </button>
        <span className="ml-auto flex items-center gap-2">
          {staleCatalog && (
            <button
              type="button"
              className="kh-stale"
              onClick={() => location.reload()}
              title="Une copie locale du catalogue (Admin) masque catalog.json — les modifications du fichier ne sont pas reflétées. Recharger la page, ou Admin › Réinit. pour repartir du fichier."
            >
              ⚠ catalogue local ≠ fichier — recharger
            </button>
          )}
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </span>
      </nav>
      <div className="min-h-0 flex-1">
        {view === "builder" ? (
          <ListBuilder />
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--bone-faint)" }}>
                Chargement de l'éditeur…
              </div>
            }
          >
            <AdminCatalog />
          </Suspense>
        )}
      </div>
    </div>
  );
}
