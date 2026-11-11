export const LEVELS = [
  { label: "Normal", tone: "ok", text: "Operating normally. Continue machining." },
  { label: "Warning", tone: "warn", text: "Wear is rising. Reduce feed and plan a tool change." },
  { label: "Critical", tone: "bad", text: "Wear is close to the limit. Replace the tool now." },
  { label: "Limit exceeded", tone: "bad", text: "Wear has passed the limit. Stop machining and change the tool." },
];
const REC = { continue: 0, reduce_feed: 1, replace_tool: 2 };
export const levelOf = (r, t) => (r.pred >= t ? 3 : REC[r.rec] ?? 0);

// First cut at which each higher level was reached (oldest first). Derived from the readings,
// so it survives a page reload.
export function alertEvents(rows, t) {
  const out = []; let seen = 0;
  for (const r of rows) {
    const l = levelOf(r, t);
    if (l > seen) { out.push({ cut: r.cut, level: l, wear: r.pred }); seen = l; }
  }
  return out;
}
