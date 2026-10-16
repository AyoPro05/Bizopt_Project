/** Remove account content before another identity can use this browser. */
export async function clearAccountClientCaches() {
  if (typeof window === "undefined") return;
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[kind];
      for (const key of Object.keys(storage)) {
        if (key.startsWith("bizopt:") || key.startsWith("bizopt-draft")) storage.removeItem(key);
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
  }
  if ("caches" in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => /^bizopt([:-]|$)/i.test(name)).map((name) => caches.delete(name)));
    } catch { /* A browser can disable Cache Storage. */ }
  }
  window.dispatchEvent(new Event("bizopt:account-cleared"));
}

/** Keep server-backed account state when disabling optional browser recovery. */
export function clearLocalDraftRecoveryCopies() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("bizopt:seo:") || key.startsWith("bizopt-draft")) window.localStorage.removeItem(key);
    }
  } catch { /* Recovery storage may be disabled. */ }
}
