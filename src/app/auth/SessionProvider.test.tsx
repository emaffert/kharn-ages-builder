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
  /** Événement émis au montage (`PASSWORD_RECOVERY` simule le retour d'un lien e-mail). */
  event?: string;
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
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    rpc: vi.fn(async () => ({ error: null })),
    updateProfile: vi.fn(async (patch: unknown) => ({ error: null, patch })),
    unsubscribe: vi.fn(),
  };
  const client = {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        cb(options.event ?? "INITIAL_SESSION", options.session ?? null);
        return { data: { subscription: { unsubscribe: calls.unsubscribe } } };
      },
      signInWithPassword: calls.signInWithPassword,
      signUp: calls.signUp,
      signOut: calls.signOut,
      resetPasswordForEmail: calls.resetPasswordForEmail,
      updateUser: calls.updateUser,
    },
    rpc: calls.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: options.profile ?? null }) }),
      }),
      update: (patch: unknown) => ({ eq: () => calls.updateProfile(patch) }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** Sonde : rend la session sous forme de texte + déclencheurs d'actions. */
function Probe() {
  const { status, profile, isAdmin, recovering, signIn, signUp, signOut, requestPasswordReset, updatePassword, updatePseudo, deleteAccount } =
    useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="pseudo">{profile?.pseudo ?? "-"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <button onClick={() => void signIn("a@b.c", "secret")}>signIn</button>
      <button onClick={() => void signUp("a@b.c", "secret", "Xayin")}>signUp</button>
      <button onClick={() => void signOut()}>signOut</button>
      <button onClick={() => void requestPasswordReset("a@b.c")}>reset</button>
      <button onClick={() => void updatePassword("nouveau-secret")}>newPassword</button>
      <button onClick={() => void updatePseudo("Nyx")}>pseudo</button>
      <button onClick={() => void deleteAccount()}>delete</button>
      <span data-testid="recovering">{String(recovering)}</span>
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

  it("délègue réinitialisation, nouveau mot de passe, pseudo et suppression de compte", async () => {
    const { client, calls } = fakeClient({
      session: { user: { id: "u1", email: "a@b.c" } },
      profile: { id: "u1", pseudo: "Xayin", role: "user" },
    });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText("Xayin");
    fireEvent.click(screen.getByText("reset"));
    fireEvent.click(screen.getByText("newPassword"));
    fireEvent.click(screen.getByText("pseudo"));
    fireEvent.click(screen.getByText("delete"));
    expect(calls.resetPasswordForEmail).toHaveBeenCalledWith("a@b.c", expect.objectContaining({ redirectTo: expect.any(String) }));
    expect(calls.updateUser).toHaveBeenCalledWith({ password: "nouveau-secret" });
    expect(calls.updateProfile).toHaveBeenCalledWith({ pseudo: "Nyx" });
    // La suppression passe par la fonction serveur, puis ferme la session.
    expect(calls.rpc).toHaveBeenCalledWith("delete_account");
    await vi.waitFor(() => expect(calls.signOut).toHaveBeenCalled());
  });

  it("impose le choix d'un mot de passe au retour d'un lien de réinitialisation", async () => {
    const { client } = fakeClient({ session: { user: { id: "u1", email: "a@b.c" } }, event: "PASSWORD_RECOVERY" });
    render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText("true")).toBeTruthy();
  });
});
