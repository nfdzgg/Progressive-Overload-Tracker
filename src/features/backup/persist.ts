/**
 * Asks the browser to keep this app's data even under storage pressure
 * (SPEC 6.1). Optional: unavailable APIs, refusals, and errors are ignored.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (storage && typeof storage.persist === 'function') await storage.persist();
  } catch {
    // Persistence is best effort; the app works without it.
  }
}
