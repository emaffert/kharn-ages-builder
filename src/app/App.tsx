import { Suspense, lazy, useState } from "react";
import { ListBuilder } from "./ListBuilder";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";

// L'écran Admin (éditeur de catalogue, volumineux) n'est pas sur le chemin critique du
// constructeur : on le charge à la demande pour alléger le bundle initial.
const AdminCatalog = lazy(() => import("./AdminCatalog").then((m) => ({ default: m.AdminCatalog })));

export function App() {
  const [view, setView] = useState<"builder" | "admin">("builder");
  const [theme, setTheme] = useTheme();
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
        <span className="ml-auto">
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
