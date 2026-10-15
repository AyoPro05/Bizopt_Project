// Invitation fragments and private form bodies must never enter telemetry.
export function scrubMonitoringEvent<T extends object>(event: T): T {
  function scrub(value: unknown, key = ""): unknown {
    if (["cookies", "headers", "query_string", "user", "request_body", "body", "form", "password", "token"].includes(key)) return undefined;
    if (typeof value === "string" && (key === "url" || key.endsWith(".url") || key === "from" || key === "to")) return value.split(/[?#]/, 1)[0];
    if (Array.isArray(value)) return value.map((item) => scrub(item));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([name]) => !(key === "request" && name === "data")).map(([name, entry]) => [name, scrub(entry, name)]).filter(([, entry]) => entry !== undefined));
    return value;
  }
  return scrub(event) as T;
}
