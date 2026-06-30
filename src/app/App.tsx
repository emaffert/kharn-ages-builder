export function App() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Khârn-Âges — Constructeur de listes
        </h1>
        <p className="text-stone-400">
          Squelette initialisé : React + TypeScript + Vite + Tailwind, en PWA local-first.
        </p>
        <p className="text-sm text-stone-500">
          Architecture en couches : <code>core</code> (métier) · <code>data</code> (catalogue) ·{" "}
          <code>ui</code> · <code>app</code>.
        </p>
      </div>
    </main>
  );
}
