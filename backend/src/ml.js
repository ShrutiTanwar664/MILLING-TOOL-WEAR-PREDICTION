// Thin client for the deployed ML API (Render free tier can take ~50s to wake up).
const ML = process.env.ML_URL, TOOL = process.env.TOOL_ID || "c6-demo";
const call = (path, opts = {}) =>
  fetch(`${ML}${path}`, { ...opts, signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json" } });

export const mlReset = () => call(`/predict/${TOOL}`, { method: "DELETE" }).catch(() => {});
export async function mlPredict(features) {
  const r = await call(`/predict/${TOOL}`, { method: "POST", body: JSON.stringify({ features }) });
  if (!r.ok) throw new Error(`ML API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json(); // { cut, flutes[3], max_wear, rul|null, recommendation }
}
