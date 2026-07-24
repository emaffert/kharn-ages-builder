import { Suspense, lazy, useMemo, useState } from "react";
import { localCatalogDivergesFromFile } from "@data";
import { AccountMenu } from "./auth/AccountMenu";
import { useSession } from "./auth/context";
import { SessionProvider } from "./auth/SessionProvider";
import { ListBuilder } from "./ListBuilder";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";

// L'écran Admin (éditeur de catalogue, volumineux) n'est pas sur le chemin critique du
// constructeur : on le charge à la demande pour alléger le bundle initial.
const AdminCatalog = lazy(() => import("./AdminCatalog").then((m) => ({ default: m.AdminCatalog })));

export function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

/** Coquille de l'app, sous la session. Exportée pour être testée avec une session simulée. */
export function AppShell() {
  const [view, setView] = useState<"builder" | "admin">("builder");
  const [theme, setTheme] = useTheme();
  const { status, isAdmin } = useSession();
  // Sans backend configuré, l'app reste en local-first : l'admin garde l'accès libre qu'il
  // avait avant les comptes. Avec backend, il est réservé au rôle `admin`.
  const canAdmin = status === "unconfigured" || isAdmin;
  // Vue effective : perdre le rôle en cours de route (déconnexion, session restaurée en simple
  // joueur) ramène au constructeur sans avoir à remettre l'état à zéro.
  const activeView = canAdmin ? view : "builder";
  // Garde-fou dev : signale qu'une copie locale du catalogue masque `catalog.json`.
  // Recalculé au changement de vue (ex. après un Réinit. dans l'Admin) - `view` est volontaire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const staleCatalog = useMemo(() => import.meta.env.DEV && localCatalogDivergesFromFile(), [view]);
  return (
    <div className="kh-shell flex h-screen flex-col">
      <nav className="kh-topbar flex items-center gap-2 px-4 py-1.5">
        <span className="kh-brand mr-3 text-sm font-bold">Khârn-Âges</span>
        <button
          onClick={() => setView("builder")}
          data-on={activeView === "builder"}
          className="kh-tab rounded px-3 py-1 text-sm font-medium"
        >
          Constructeur
        </button>
        {canAdmin && (
          <button
            onClick={() => setView("admin")}
            data-on={activeView === "admin"}
            className="kh-tab rounded px-3 py-1 text-sm font-medium"
          >
            Admin
          </button>
        )}
        <span className="ml-auto flex items-center gap-2">
          {staleCatalog && (
            <button
              type="button"
              className="kh-stale"
              onClick={() => location.reload()}
              title="Une copie locale du catalogue (Admin) masque catalog.json - les modifications du fichier ne sont pas reflétées. Recharger la page, ou Admin › Réinit. pour repartir du fichier."
            >
              ⚠ catalogue local ≠ fichier - recharger
            </button>
          )}
          <AccountMenu />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </span>
      </nav>
      <div className="min-h-0 flex-1">
        {activeView === "admin" ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--bone-faint)" }}>
                Chargement de l'éditeur…
              </div>
            }
          >
            <AdminCatalog />
          </Suspense>
        ) : (
          <ListBuilder />
        )}
      </div>
    </div>
  );
}
