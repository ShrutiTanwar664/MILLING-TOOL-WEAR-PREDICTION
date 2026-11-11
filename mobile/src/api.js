import { API_URL } from "./config";

async function call(path, opts) {
  const r = await fetch(API_URL + path, opts);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
export const snapshot = since => call(`/api/snapshot?since=${since}`);
export const control = (action, body = {}) =>
  call(`/api/simulation/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
