// Thin client for the deployed ML API.
// Render's free tier can take approximately 50 seconds to wake up.
const ML = process.env.ML_URL, TOOL = process.env.TOOL_ID || "c6-demo";

// Centralized API request handler with a 90-second timeout.
// All requests are sent with JSON content type.
const call = (path, opts = {}) =>
  fetch(`${ML}${path}`, { ...opts, signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json" } });

// Clear the prediction history maintained by the ML API.
// Errors are ignored because the local simulator should still be able to reset.
export const mlReset = () => call(`/predict/${TOOL}`, { method: "DELETE" }).catch(() => {});

// Send sensor features to the ML model and return its predictions.
export async function mlPredict(features) {
  const r = await call(`/predict/${TOOL}`, { method: "POST", body: JSON.stringify({ features }) });

  // Throw an error if the API request fails, including the HTTP status and response.
  if (!r.ok) throw new Error(`ML API ${r.status}: ${(await r.text()).slice(0, 200)}`);

  // Response contains: cut, flutes[3], max_wear, rul|null, recommendation.
  return r.json();
}
