// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// A tab opened before a deploy still asks for the old screen chunks. The host now answers those
// addresses with the HTML page, so the import fails. The page reloads once to pick up the new
// build, and shows the error screen only if the chunk fails again. A note in sessionStorage
// keeps it to one reload, so a chunk that is really broken can never reload the page in a loop.

export const CHUNK_RELOAD_KEY = 'ember-chunk-reload'
// A second failure within this time of the last reload is shown, not reloaded.
export const CHUNK_RELOAD_WINDOW_MS = 60_000

// Chrome, Firefox and Safari word a failed dynamic import differently. A chunk that comes back as
// HTML fails as a module script with the wrong MIME type.
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (CSS )?chunk .* failed|Unable to preload CSS|is not a valid JavaScript MIME type/i

export function isChunkError(error: unknown): boolean {
  if (!error) return false
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return CHUNK_ERROR.test(text)
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Reloads the page for a failed chunk, at most once per window. True when it reloaded. */
export function reloadOnceForChunk(error: unknown, store: Store | null, reload: () => void, now = Date.now()): boolean {
  if (!isChunkError(error) || !store) return false
  try {
    const last = Number(store.getItem(CHUNK_RELOAD_KEY))
    if (Number.isFinite(last) && last > 0 && now - last < CHUNK_RELOAD_WINDOW_MS) return false
    store.setItem(CHUNK_RELOAD_KEY, String(now))
  } catch {
    // Without storage there is no guard against a loop, so the error screen shows instead.
    return false
  }
  reload()
  return true
}

const sessionStore = (): Store | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** A screen loader that reloads the page once when its chunk is stale, and fails as before otherwise. */
export function withChunkReload<T>(load: () => Promise<T>, store: () => Store | null = sessionStore, reload: () => void = () => window.location.reload()): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      // While the page reloads, the screen keeps its loading state rather than flashing an error.
      if (reloadOnceForChunk(error, store(), reload)) return new Promise<T>(() => {})
      throw error
    })
}
