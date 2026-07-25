// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { catalog, readPublishedCatalog } from "@data";
import { PullPublishedAction } from "./PullPublishedAction";
import { ResetToFileAction } from "./ResetToFileAction";
import { createMemoryStorage } from "../../testing/memoryStorage";

afterEach(cleanup);
beforeEach(() => vi.stubGlobal("localStorage", createMemoryStorage()));

/** Faux serveur renvoyant (ou non) une version publiée. */
function server(row: { id: number; version: string; data: unknown; published_at: string | null } | null) {
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const remote = { id: 5, version: "0.3.0", data: { ...catalog, version: "0.3.0" }, published_at: null };

describe("PullPublishedAction", () => {
  it("reste invisible sans backend", () => {
    const { container } = render(<PullPublishedAction dirty={false} onPulled={vi.fn()} client={null} />);
    expect(container.textContent).toBe("");
  });

  it("prévient de la perte du brouillon avant de remplacer", () => {
    render(<PullPublishedAction dirty onPulled={vi.fn()} client={server(remote)} />);
    fireEvent.click(screen.getByRole("button", { name: "Repartir de la version publiée" }));
    expect(screen.getByText(/modifications locales non publiées seront perdues/i)).toBeTruthy();
  });

  it("adopte la version publiée et la met en cache", async () => {
    const onPulled = vi.fn();
    render(<PullPublishedAction dirty={false} onPulled={onPulled} client={server(remote)} />);
    fireEvent.click(screen.getByRole("button", { name: "Repartir de la version publiée" }));
    fireEvent.click(screen.getByRole("button", { name: "Remplacer" }));
    await waitFor(() => expect(onPulled).toHaveBeenCalled());
    expect(onPulled.mock.calls[0][0].version).toBe("0.3.0");
    expect(readPublishedCatalog()?.versionId).toBe(5);
  });

  it("signale l'absence de version publiée sans rien changer", async () => {
    const onPulled = vi.fn();
    render(<PullPublishedAction dirty={false} onPulled={onPulled} client={server(null)} />);
    fireEvent.click(screen.getByRole("button", { name: "Repartir de la version publiée" }));
    fireEvent.click(screen.getByRole("button", { name: "Remplacer" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onPulled).not.toHaveBeenCalled();
    expect(readPublishedCatalog()).toBeNull();
  });
});

describe("ResetToFileAction", () => {
  it("demande confirmation avant de revenir au fichier", () => {
    const onReset = vi.fn();
    render(<ResetToFileAction dirty onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Repartir du fichier" }));
    expect(screen.getByText(/modifications locales non publiées seront perdues/i)).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("repart du fichier une fois confirmé", () => {
    const onReset = vi.fn();
    render(<ResetToFileAction dirty={false} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Repartir du fichier" }));
    fireEvent.click(screen.getByRole("button", { name: "Remplacer" }));
    expect(onReset).toHaveBeenCalled();
  });
});
