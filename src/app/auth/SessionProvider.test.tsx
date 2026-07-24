// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SessionProvider } from "./SessionProvider";
import { useSession, type Profile } from "./context";

afterEach(cleanup);

type FakeOptions = {
  /** Session rendue par `onAuthStateChange` au montage (null = anonyme). */
  session?: { user: { id: string; email: string } } | null;
  profile?: Profile | null;
  signInError?: { message: string } | null;
  signUpSession?: unknown;
};

/**
 * Faux client Supabase : reproduit la surface utilisée par le provider (écoute des
 * changements d'auth + lecture de `profiles`), sans réseau.
 */
function fakeClient(options: FakeOptions = {}) {
  const calls = {
    signInWithPassword: vi.fn(async () => ({ error: options.signInError ?? null })),
    signUp: vi.fn(async () => ({ data: { session: options.signUpSession ?? null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    unsubscribe: vi.fn(),
  };
  const client = {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        cb("INITIAL_SESSION", options.session ?? null);
        return { data: { subscription: { unsubscribe: calls.unsubscribe } } };
      },
      signInWithPassword: calls.signInWithPassword,
      signUp: calls.signUp,
      signOut: calls.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: options.profile ?? null }) }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** Sonde : rend la session sous forme de texte + déclencheurs d'actions. */
function Probe() {
  const { status, profile, isAdmin, signIn, signUp, signOut } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="pseudo">{profile?.pseudo ?? "-"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <button onClick={() => void signIn("a@b.c", "secret")}>signIn</button>
      <button onClick={() => void signUp("a@b.c", "secret", "Xayin")}>signUp</button>
      <button onClick={() => void signOut()}>signOut</button>
    </div>
  );
}

const status = () => screen.getByTestId("status").textContent;

describe("SessionProvider", () => {
  it("reste inerte sans client (app local-first)", () => {
    render(
      <SessionProvider client={null}>
        <Probe />
      </SessionProvider>,
    );
    expect(status()).toBe("unconfigured");
    expect(screen.getByTestId("admin").textContent).toBe("false");
  });

  it("passe à anonyme quand aucune session n'est restaurée", async () => {
    const { client } = fakeClient({ session: null });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText("anonymous")).toBeTruthy();
  });

  it("charge le profil et expose le rôle admin", async () => {
    const { client } = fakeClient({
      session: { user: { id: "u1", email: "a@b.c" } },
      profile: { id: "u1", pseudo: "Xayin", role: "admin" },
    });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(await screen.findByText("Xayin")).toBeTruthy();
    expect(screen.getByTestId("admin").textContent).toBe("true");
  });

  it("n'accorde pas l'admin à un simple joueur", async () => {
    const { client } = fakeClient({
      session: { user: { id: "u2", email: "j@b.c" } },
      profile: { id: "u2", pseudo: "Joueur", role: "user" },
    });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText("Joueur")).toBeTruthy();
    expect(screen.getByTestId("admin").textContent).toBe("false");
  });

  it("délègue connexion, inscription (avec pseudo) et déconnexion au client", async () => {
    const { client, calls } = fakeClient({ session: null });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByText("signIn"));
    fireEvent.click(screen.getByText("signUp"));
    fireEvent.click(screen.getByText("signOut"));
    expect(calls.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.c", password: "secret" });
    expect(calls.signUp).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "secret",
      options: { data: { pseudo: "Xayin" } },
    });
    expect(calls.signOut).toHaveBeenCalled();
  });

  it("se désabonne au démontage", () => {
    const { client, calls } = fakeClient({ session: null });
    const { unmount } = render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    unmount();
    expect(calls.unsubscribe).toHaveBeenCalled();
  });
});
