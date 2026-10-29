import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";

const post = (p, b) => fetch("/api/" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) });
const STATUS = {
  continue: { label: "Normal", tone: "ok", advice: "Tool is healthy. Continue machining." },
  reduce_feed: { label: "Warning", tone: "warn", advice: "Wear is rising. Reduce feed and plan a tool change." },
  replace_tool: { label: "Critical", tone: "bad", advice: "Wear is near the limit. Replace the tool now." },
};
const SPEEDS = [["Slow", 1500], ["Normal", 800], ["Fast", 200], ["Turbo", 50]];
const zone = (w, t) => (w / t < 0.6 ? "ok" : w / t < 0.85 ? "warn" : "bad");
const pretty = k => k.replace(/_/g, " ");
const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));

export default function App() {
  const [s, setS] = useState({ running: false, index: 0, total: 0, threshold: 180, delay: 800, error: null });
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("init", e => { const d = JSON.parse(e.data); setS(d.state); setRows(d.readings); });
    es.addEventListener("reading", e => setRows(r => [...r, JSON.parse(e.data)]));
    es.addEventListener("state", e => setS(JSON.parse(e.data)));
    es.addEventListener("reset", () => setRows([]));
    return () => es.close();
  }, []);

  const t = s.threshold, last = rows.at(-1);
  const st = last ? STATUS[last.rec] : { label: "Idle", tone: "idle", advice: "Press Start to begin the simulation." };
  const done = s.total && s.index >= s.total;
  const worst = last ? last.flutes.indexOf(Math.max(...last.flutes)) : -1;
  const used = last ? Math.min(100, (last.pred / t) * 100) : 0;
  const yMax = Math.round(t * 1.3);

  return (
    <div className="page">
      <header>
        <div className="brand"><div className="logo">T</div>
          <div><h1>ToolSense</h1><p>Live tool wear and remaining life · replay of cutter c6</p></div></div>
        <div className="controls">
          <select value={s.delay} onChange={e => post("simulation/speed", { delay: +e.target.value })}>
            {SPEEDS.map(([n, v]) => <option key={v} value={v}>Speed: {n}</option>)}
          </select>
          {s.running
            ? <button onClick={() => post("simulation/pause")}>Pause</button>
            : <button className="primary" disabled={done} onClick={() => post("simulation/start", { delay: s.delay })}>{s.index ? "Resume" : "Start"}</button>}
          <button onClick={() => post("simulation/reset")}>Reset</button>
        </div>
      </header>

      {s.error && <div className="banner">Simulation stopped: {s.error}. Press Resume to continue.</div>}

      <div className="progress"><div style={{ width: `${s.total ? (s.index / s.total) * 100 : 0}%` }} /></div>
      <p className="muted">Cut {s.index} of {s.total}{done ? " · run complete" : ""}{s.running ? " · running" : ""}</p>

      <section className={`hero ${st.tone}`}>
        <div className="dot" />
        <div className="heroText"><span>Tool status</span><b>{st.label}</b><small>{st.advice}</small></div>
        <div className="life">
          <span>Wear limit used</span>
          <div className="bar big"><div style={{ width: `${used}%` }} /></div>
          <small>{fmt(used, 0)}% of {t} µm</small>
        </div>
      </section>

      <section className="grid">
        <div className="card"><span>Remaining useful life</span>
          <b>{last?.rul != null ? last.rul : "—"}<em> cuts</em></b>
          <small>{last && last.rul == null ? "Warming up (needs 30 cuts)" : "Cuts left before the wear limit"}</small></div>
        <div className="card"><span>Max wear (worst flute)</span>
          <b>{fmt(last?.pred)}<em> µm</em></b>
          <small>Actual: {fmt(last?.actual)} µm · limit {t} µm</small></div>
        <div className="card"><span>Current cut</span>
          <b>{last ? last.cut : "—"}<em> / {s.total}</em></b>
          <small>One cut per step of the simulation</small></div>
      </section>

      <div className="sectionHead"><h2>Cutting edges (flutes)</h2>
        <p>The cutter has 3 cutting edges called flutes. Each wears on its own, and the tool is replaced when the worst one reaches the limit.</p></div>
      <section className="grid">
        {[0, 1, 2].map(i => {
          const w = last?.flutes[i] ?? 0, a = last?.actualFlutes?.[i];
          return (
            <div className={`card flute ${last ? zone(w, t) : ""}`} key={i}>
              <span>Flute {i + 1}{i === worst && <i className="badge">Worst</i>}</span>
              <b>{last ? fmt(w) : "—"}<em> µm</em></b>
              <div className="bar"><div style={{ width: `${Math.min(100, (w / t) * 100)}%` }} /></div>
              <small>Actual: {fmt(a)} µm</small>
            </div>
          );
        })}
      </section>

      <section className="card">
        <div className="cardHead"><span>Predicted vs actual wear</span>
          <small className="legend"><i className="z ok" />Normal <i className="z warn" />Warning <i className="z bad" />Critical</small></div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <ReferenceArea y1={0} y2={t * 0.6} fill="#16a34a" fillOpacity={0.07} />
            <ReferenceArea y1={t * 0.6} y2={t * 0.85} fill="#d97706" fillOpacity={0.09} />
            <ReferenceArea y1={t * 0.85} y2={yMax} fill="#dc2626" fillOpacity={0.08} />
            <CartesianGrid stroke="#eef0f3" />
            <XAxis dataKey="cut" /><YAxis unit=" µm" domain={[0, yMax]} allowDataOverflow /><Tooltip /><Legend />
            <ReferenceLine y={t} stroke="#dc2626" strokeDasharray="5 5" label={{ value: "Limit", fill: "#dc2626", fontSize: 12 }} />
            <Line dataKey="pred" name="Predicted" stroke="#2563eb" dot={false} strokeWidth={2.5} isAnimationActive={false} />
            <Line dataKey="actual" name="Actual" stroke="#6b7280" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <div className="cardHead"><span>Remaining useful life over time</span></div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" />
            <XAxis dataKey="cut" /><YAxis unit=" cuts" /><Tooltip />
            <Line dataKey="rul" name="Predicted RUL" stroke="#7c3aed" dot={false} strokeWidth={2.5} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <div className="cardHead"><span>Sensor inputs for the current cut (features sent to the model)</span></div>
        <div className="inputs">
          {last ? Object.entries(last.inputs).map(([k, v]) => <div key={k}><small>{pretty(k)}</small><b>{Number(v).toPrecision(4)}</b></div>)
                : <p className="muted">No data yet</p>}
        </div>
      </section>

      <section className="card">
        <div className="cardHead"><span>Recent cuts</span></div>
        <div className="tableWrap"><table>
          <thead><tr><th>Cut</th><th>Flute 1</th><th>Flute 2</th><th>Flute 3</th><th>Max</th><th>RUL</th><th>Status</th></tr></thead>
          <tbody>
            {rows.slice(-6).reverse().map(r => (
              <tr key={r.cut}><td>{r.cut}</td>{r.flutes.map((f, i) => <td key={i}>{fmt(f)}</td>)}
                <td>{fmt(r.pred)}</td><td>{r.rul ?? "—"}</td>
                <td><span className={`pill ${STATUS[r.rec].tone}`}>{STATUS[r.rec].label}</span></td></tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="muted">No data yet</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}