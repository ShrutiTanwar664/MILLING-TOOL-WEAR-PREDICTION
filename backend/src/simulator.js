// Replays the C6 dataset one cut at a time, sends sensor features to the ML API,
// stores predictions, and broadcasts results to connected dashboard clients.
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { mlPredict, mlReset } from "./ml.js";


// ---------------- DATASET LOADING AND PREPROCESSING ----------------

// Columns excluded from ML input features because they contain identifiers
// or actual wear measurements rather than sensor inputs.
const IGNORE = ["cut_number", "max_wear", "cutter", "flute_1", "flute_2", "flute_3"];

// Load the aggregated sensor dataset, convert rows into objects,
// automatically cast numeric values, and sort by machining cut number.
const rows = parse(readFileSync(new URL("../data/c6_aggregated_features.csv", import.meta.url)), { columns: true, cast: true })
  .sort((a, b) => a.cut_number - b.cut_number);

// Filter invalid wear measurements (e.g. sensor glitches) to prevent
// extreme outliers from distorting dashboard chart scales.
const clean = v => (typeof v === "number" && v > 400 ? null : v);


// ---------------- DASHBOARD INPUT FEATURES ----------------

// Preferred sensor features to display in the dashboard's inputs panel.
// Matching CSV columns are selected dynamically using these prefixes.
const KEY = ["force_x", "force_y", "force_z", "vibration_x", "vibration_y", "vibration_z", "ae_rms"];

const names = Object.keys(rows[0]).filter(k => !IGNORE.includes(k));

// Select representative mean, RMS, or standard deviation features
// for each sensor category. Unavailable categories are skipped.
const shown = KEY.map(k => names.find(n => n.toLowerCase().startsWith(k) && /mean|rms|std/.test(n.toLowerCase())))
  .filter(Boolean);

// Fall back to the first seven available features if preferred matches are unavailable.
const showNames = shown.length ? shown : names.slice(0, 7);


// ---------------- CENTRAL SIMULATION STATE ----------------

// Shared state used by the backend routes and simulation engine.
export const sim = {
  state: {
    running: false,                          // Whether the simulation is active.
    index: 0,                                // Index of the next dataset row to process.
    total: rows.length,                      // Total number of available cuts.
    delay: 500,                              // Interval between cuts (milliseconds).
    error: null,                             // Latest simulation error, if any.
    threshold: Number(process.env.THRESHOLD) || 180, // Tool wear threshold.
  },
  readings: [],                              // Historical predictions and actual readings.
  clients: new Set(),                        // Active Server-Sent Events connections.
  timer: null,                               // Timer for scheduling the next cut.
};


// ---------------- SERVER-SENT EVENTS ----------------

// Broadcast an event and its JSON payload to all connected dashboard clients.
export const send = (event, data) => {
  for (const c of sim.clients) c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

// Notify clients whenever the simulation state changes.
const pushState = () => send("state", sim.state);


// ---------------- SIMULATION ENGINE ----------------

// Process one machining cut: extract features, request an ML prediction,
// combine predicted and actual values, store the result, and broadcast it.
async function tick() {
  const s = sim.state;
  const t0 = Date.now();

  if (!s.running) return;

  // Stop automatically when every dataset row has been processed.
  if (s.index >= rows.length) { s.running = false; return pushState(); }

  const row = rows[s.index];

  try {
    // Extract only the sensor features required by the ML model.
    const features = Object.fromEntries(names.map(n => [n, row[n]]));
    let p;

    // Retry temporary network failures up to two times.
    // API/application errors are not retried.
    for (let attempt = 0; ; attempt++) {
      try { p = await mlPredict(features); break; }
      catch (e) {
        if (!(e instanceof TypeError) || attempt >= 2) throw e;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Verify that the ML API and local simulator are processing the same cut.
    // A mismatch indicates that their prediction histories are out of sync.
    if (p.cut !== s.index + 1) throw new Error("Out of sync with ML API. Press Reset and start again.");

    // Combine ML predictions with actual dataset measurements and selected inputs.
    const reading = {
      cut: p.cut,
      flutes: p.flutes,
      pred: p.max_wear,
      rul: p.rul,
      rec: p.recommendation,
      actual: clean(row.max_wear),
      actualFlutes: [row.flute_1, row.flute_2, row.flute_3].map(clean),
      inputs: Object.fromEntries(showNames.map(n => [n, row[n]])),
    };

    // Store the completed reading and advance to the next dataset row.
    sim.readings.push(reading);
    s.index++; s.error = null;

    // Immediately broadcast the new reading to connected dashboard clients.
    send("reading", reading);

  } catch (e) {
    // Stop processing and broadcast the error so the frontend can display it.
    s.running = false; s.error = e.message; pushState(); return;
  }

  // Schedule the next cut. The delay is calculated from the start of this tick,
  // so ML API response time does not get added on top of the configured interval.
  if (s.running) sim.timer = setTimeout(tick, Math.max(0, s.delay - (Date.now() - t0)));
}


// ---------------- SIMULATION CONTROL FUNCTIONS ----------------

// Start or resume simulation from the current dataset index.
export function start(delay) {
  if (delay) sim.state.delay = delay;
  if (sim.state.running) return;
  if (sim.state.index >= rows.length) return;

  sim.state.running = true; sim.state.error = null;
  pushState();
  tick();
}

// Update simulation speed. The minimum allowed interval is 20 milliseconds.
export function setSpeed(d) { sim.state.delay = Math.max(20, Number(d) || 500); pushState(); }

// Pause the simulation while preserving its current progress and readings.
export function pause() { clearTimeout(sim.timer); sim.state.running = false; pushState(); }

// Reset local simulation data and ML API history to ensure both start from cut one.
export async function reset() {
  clearTimeout(sim.timer);
  Object.assign(sim.state, { running: false, index: 0, error: null });
  sim.readings = [];

  await mlReset();

  // Notify connected clients to clear their displayed readings and refresh state.
  send("reset", {}); pushState();
}
