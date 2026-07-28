import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Polices self-hostées (PWA hors-ligne) : Inter (UI/données) + Cinzel (titrage).
// Sous-ensembles latin + latin-ext uniquement (suffisant pour le français, précache léger).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "@fontsource/cinzel/latin-500.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-ext-500.css";
import "@fontsource/cinzel/latin-ext-600.css";
import "@fontsource/cinzel/latin-ext-700.css";
import { App } from "@app/App";
import { setupServiceWorker } from "./pwa";
import { ErrorBoundary } from "@app/ErrorBoundary";
import "./index.css";

// Enregistré avant le rendu : la recherche de mise à jour ne dépend pas de React.
setupServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Élément racine #root introuvable.");

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
