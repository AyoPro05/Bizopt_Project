/** Client-side device fingerprint for API requests (paid features). */
export function getClientFingerprint(): string {
  if (typeof window === "undefined") return "";
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  return btoa(parts.join("|")).slice(0, 64);
}

export function deviceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const fp = getClientFingerprint();
  const headers = new Headers(init?.headers);
  if (fp) headers.set("x-device-fingerprint", fp);
  return fetch(input, { ...init, headers });
}
