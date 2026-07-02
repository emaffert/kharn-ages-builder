import { Suspense, lazy, useState } from "react";
import { ListBuilder } from "./ListBuilder";

// L'écran Admin (éditeur de catalogue, volumineux) n'est pas sur le chemin critique du
// constructeur : on le charge à la demande pour alléger le bundle initial.
const AdminCatalog = lazy(() => import("./AdminCatalog").then((m) => ({ default: m.AdminCatalog })));

export function App() {
  const [view, setView] = useState<"builder" | "admin">("builder");
  const tab = (active: boolean) =>
    `rounded px-3 py-1 text-sm font-medium ${
      active ? "bg-amber-600 text-amber-50" : "text-stone-300 hover:bg-stone-800"
    }`;
  return (
    <div className="flex h-screen flex-col bg-stone-950">
      <nav className="flex items-center gap-2 border-b border-stone-800 bg-stone-900 px-4 py-1.5">
        <span className="mr-3 text-sm font-bold text-amber-300">Khârn-Âges</span>
        <button onClick={() => setView("builder")} className={tab(view === "builder")}>
          Constructeur (aperçu)
        </button>
        <button onClick={() => setView("admin")} className={tab(view === "admin")}>
          Admin
        </button>
      </nav>
      <div className="min-h-0 flex-1">
        {view === "builder" ? (
          <ListBuilder />
        ) : (
          <Suspense
            fallback={<div className="flex h-full items-center justify-center text-sm text-stone-400">Chargement de l'éditeur…</div>}
          >
            <AdminCatalog />
          </Suspense>
        )}
      </div>
    </div>
  );
}
