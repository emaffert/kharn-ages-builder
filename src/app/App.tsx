import { Suspense, lazy, useState } from "react";
import { localCatalogDivergesFromFile } from "@data";
import { AccountMenu } from "./auth/AccountMenu";
import { useSession } from "./auth/context";
import { PasswordRecovery } from "./auth/PasswordRecovery";
import { SessionProvider } from "./auth/SessionProvider";
import { CatalogProvider } from "./catalog/CatalogProvider";
import { ListBuilder } from "./ListBuilder";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";

// L'écran Admin (éditeur de catalogue, volumineux) n'est pas sur le chemin critique du
// constructeur : on le charge à la demande pour alléger le bundle initial.
const AdminCatalog = lazy(() => import("./AdminCatalog").then((m) => ({ default: m.AdminCatalog })));

export function App() {
  return (
    <SessionProvider>
      <CatalogProvider>
        <AppShell />
        {/* Hors de la coquille : le retour d'un lien de réinitialisation doit s'imposer, quel que
            soit l'écran affiché. */}
        <PasswordRecovery />
      </CatalogProvider>
    </SessionProvider>
  );
}

/** Coquille de l'app, sous la session. Exportée pour être testée avec une session simulée. */
export function AppShell() {
  const [view, setView] = useState<"builder" | "admin">("builder");
  const [theme, setTheme] = useTheme();
  const { status, isAdmin } = useSession();
  // Réservé au rôle `admin`. L'exception « pas de backend configuré » (app local-first, comme
  // avant les comptes) est cantonnée au développement : en production, un `.env` oublié au build
  // ouvrirait l'admin à tout le monde au lieu de le fermer.
  const canAdmin = (import.meta.env.DEV && status === "unconfigured") || isAdmin;
  // Vue effective : perdre le rôle en cours de route (déconnexion, session restaurée en simple
  // joueur) ramène au constructeur sans avoir à remettre l'état à zéro.
  const activeView = canAdmin ? view : "builder";
  // Garde-fou dev : signale qu'un brouillon d'administration masque `catalog.json`. Évalué à chaque
  // rendu (la comparaison est cachée côté `@data`), pour que le bandeau disparaisse dès que le
  // brouillon est abandonné - y compris sans quitter l'Admin.
  const staleCatalog = import.meta.env.DEV && localCatalogDivergesFromFile();
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
              onClick={() => setView("admin")}
              title="Un brouillon d'administration est enregistré dans ce navigateur : c'est lui qui est édité et affiché, pas src/data/catalog.json - les modifications du fichier ne sont donc pas visibles. Dans l'Admin : « Repartir du fichier » pour l'abandonner, « Enregistrer » pour l'écrire dans le fichier."
            >
              ⚠ brouillon admin ≠ fichier
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
