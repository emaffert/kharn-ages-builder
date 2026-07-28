// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import changelogSource from "../../../CHANGELOG.md?raw";
import { createMemoryStorage } from "../../testing/memoryStorage";
import { entryKey, parseEntries } from "./changelog";
import { WhatsNew } from "./WhatsNew";

afterEach(cleanup);
beforeEach(() => vi.stubGlobal("localStorage", createMemoryStorage()));

const SEEN_KEY = "kharn-changelog-vu";
const currentKey = () => entryKey(parseEntries(changelogSource)[0]);
// Ciblé par rôle : le titre varie selon le nombre de versions non lues, et « Nouveautés »
// apparaît aussi dans le corps du journal.
const shown = () => screen.queryByRole("dialog") != null;

describe("annonce des nouveautés", () => {
  it("s'ouvre quand la version n'a jamais été vue", () => {
    render(<WhatsNew />);
    expect(shown()).toBe(true);
  });

  it("s'ouvre après une mise à jour, quelle que soit la façon d'y être arrivé", () => {
    // Aucun marqueur de rechargement : seule compte la signature de l'entrée déjà lue.
    localStorage.setItem(SEEN_KEY, entryKey(parseEntries(changelogSource)[1]));
    render(<WhatsNew />);
    expect(shown()).toBe(true);
  });

  it("montre toutes les versions manquées, pas seulement la dernière", () => {
    const entries = parseEntries(changelogSource);
    localStorage.setItem(SEEN_KEY, entryKey(entries[2]));
    render(<WhatsNew />);
    // Les deux entrées sautées sont datées dans la modale.
    expect(screen.getByText(entries[0].date)).toBeTruthy();
    expect(screen.getByText(entries[1].date)).toBeTruthy();
  });

  it("ne s'ouvre pas quand la version a déjà été lue", () => {
    localStorage.setItem(SEEN_KEY, currentKey());
    render(<WhatsNew />);
    expect(shown()).toBe(false);
  });

  it("retient la lecture, et ne revient donc pas à la visite suivante", () => {
    render(<WhatsNew />);
    fireEvent.click(screen.getByRole("button", { name: /J'ai lu/i }));
    expect(localStorage.getItem(SEEN_KEY)).toBe(currentKey());
    cleanup();
    render(<WhatsNew />);
    expect(shown()).toBe(false);
  });

  it("affiche les rubriques de l'entrée la plus récente", () => {
    render(<WhatsNew />);
    const latest = parseEntries(changelogSource)[0];
    expect(screen.getByText(latest.sections[0].title)).toBeTruthy();
  });
});
