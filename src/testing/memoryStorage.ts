/**
 * `localStorage` en mémoire, pour les tests.
 *
 * Sous Node ≥ 26, le global `localStorage` intégré est indisponible sans `--localstorage-file`
 * et masque celui de jsdom : tout ce qui persiste dans le navigateur est donc silencieusement
 * inerte en test. Ce stub (posé via `vi.stubGlobal`) rend ces chemins réellement testables.
 */
export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  };
}
