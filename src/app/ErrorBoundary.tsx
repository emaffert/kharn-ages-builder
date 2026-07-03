import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Frontière d'erreur React : capture une erreur de rendu (liste importée corrompue,
 * catalogue invalide…) et affiche un message de repli plutôt qu'un écran blanc.
 * Les frontières d'erreur doivent être des composants classe (pas d'équivalent hook).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Point d'accroche pour un futur rapport d'erreurs ; en dev, on trace en console.
    if (import.meta.env.DEV) console.error("ErrorBoundary a capturé une erreur :", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
          style={{ background: "var(--forge)", color: "var(--bone)" }}
        >
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Cinzel, serif", color: "var(--faction-2)" }}>
            Une erreur est survenue
          </h1>
          <p className="max-w-md text-sm" style={{ color: "var(--bone-dim)" }}>
            L'application a rencontré un problème inattendu. Tes listes sauvegardées ne sont pas affectées.
          </p>
          <pre
            className="max-w-md overflow-auto rounded p-2 text-left text-xs"
            style={{ background: "var(--tint-2)", color: "var(--bone-faint)" }}
          >
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()} className="ui-btn ui-btn--primary">
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
