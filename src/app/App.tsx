import { useState } from "react";
import { AdminCatalog } from "./AdminCatalog";
import { ListBuilderMock } from "./ListBuilderMock";

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
      <div className="min-h-0 flex-1">{view === "builder" ? <ListBuilderMock /> : <AdminCatalog />}</div>
    </div>
  );
}
