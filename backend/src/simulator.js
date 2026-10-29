// Replays c6 one cut at a time through the ML API and broadcasts each result.
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { mlPredict, mlReset } from "./ml.js";

const IGNORE = ["cut_number", "max_wear", "cutter", "flute_1", "flute_2", "flute_3"];
const rows = parse(readFileSync(new URL("../data/c6_aggregated_features.csv", import.meta.url)), { columns: true, cast: true })
  .sort((a, b) => a.cut_number - b.cut_number);

// Bad values in the wear CSV (e.g. a glitch at cut 2) would wreck the chart scale.
const clean = v => (typeof v === "number" && v > 400 ? null : v);

// Features shown in the "inputs" panel. Edit to your real names (see ML API /health).
const KEY = ["force_x", "force_y", "force_z", "vibration_x", "vibration_y", "vibration_z", "ae_rms"];
const names = Object.keys(rows[0]).filter(k => !IGNORE.includes(k));
const shown = KEY.map(k => names.find(n => n.toLowerCase().startsWith(k) && /mean|rms|std/.test(n.toLowerCase())))
  .filter(Boolean);
const showNames = shown.length ? shown : names.slice(0, 7);

export const sim = {
  state: { running: false, index: 0, total: rows.length, delay: 800, error: null,
           threshold: Number(process.env.THRESHOLD) || 180 },
  readings: [], clients: new Set(), timer: null,
};

export const send = (event, data) => {
  for (const c of sim.clients) c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
const pushState = () => send("state", sim.state);

async function tick() {
  const s = sim.state;
  if (!s.running) return;
  if (s.index >= rows.length) { s.running = false; return pushState(); }
  const row = rows[s.index];
  try {
    const features = Object.fromEntries(names.map(n => [n, row[n]]));
    let p;
    for (let attempt = 0; ; attempt++) {
      try { p = await mlPredict(features); break; }
      catch (e) {
        // retry only network-level drops ("fetch failed"), not API errors
        if (!(e instanceof TypeError) || attempt >= 2) throw e;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    // the ML API keeps history; a mismatch means a cut was counted twice
    if (p.cut !== s.index + 1) throw new Error("Out of sync with ML API. Press Reset and start again.");
    const reading = {
      cut: p.cut, flutes: p.flutes, pred: p.max_wear, rul: p.rul, rec: p.recommendation,
      actual: clean(row.max_wear), actualFlutes: [row.flute_1, row.flute_2, row.flute_3].map(clean),
      inputs: Object.fromEntries(showNames.map(n => [n, row[n]])),
    };
    sim.readings.push(reading);
    s.index++; s.error = null;
    send("reading", reading);
  } catch (e) {
    s.running = false; s.error = e.message; pushState(); return;
  }
  if (s.running) sim.timer = setTimeout(tick, s.delay);
}

export function start(delay) {
  if (delay) sim.state.delay = delay;
  if (sim.state.running) return;
  if (sim.state.index >= rows.length) return;
  sim.state.running = true; sim.state.error = null; pushState();
  tick();
}
export function pause() { clearTimeout(sim.timer); sim.state.running = false; pushState(); }
export async function reset() {
  clearTimeout(sim.timer);
  Object.assign(sim.state, { running: false, index: 0, error: null });
  sim.readings = [];
  await mlReset();               // new tool mounted -> history starts from zero
  send("reset", {}); pushState();
}