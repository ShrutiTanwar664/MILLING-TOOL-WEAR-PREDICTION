import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";
import Logo from "./Logo.jsx";
import { LEVELS, levelOf, alertEvents } from "./alerts.js";
import { useAlarmAudio } from "./audio.js";

const SPEEDS = [["Slow", 1000], ["Normal", 500], ["Fast", 150], ["Turbo", 20]];
const post = (p, b) => fetch("/api/" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(r => r.json());
const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const zone = (w, t) => (w / t < 0.6 ? "ok" : w / t < 0.85 ? "warn" : "bad");
const ax = { tick: { fontSize: 11, fill: "#5f6877" }, tickLine: false, axisLine: { stroke: "#dfe2e7" } };
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export default function App() {
  const [s, setS] = useState({ running: false, index: 0, total: 315, delay: 500, error: null, threshold: 180 });
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(null);
  const [sound, setSound] = useState(() => store.get("ts-sound") !== "off");
  const [ack, setAck] = useState(0);
  const [toasts, setToasts] = useState([]);
  const audio = useAlarmAudio();
  const prev = useRef(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("init", e => { const d = JSON.parse(e.data); setS(d.state); setRows(d.readings); });
    es.addEventListener("reading", e => setRows(r => [...r, JSON.parse(e.data)]));
    es.addEventListener("state", e => setS(JSON.parse(e.data)));
    es.addEventListener("reset", () => setRows([]));
    return () => es.close();
  }, []);

  const t = s.threshold, last = rows.at(-1);
  const level = last ? levelOf(last, t) : 0;
  const L = LEVELS[level];
  const tone = last ? L.tone : "idle";
  const alarm = level >= 2 && ack < level;
  const events = useMemo(() => alertEvents(rows, t).reverse(), [rows, t]);
  const done = s.index >= s.total;
  const used = last ? Math.min(100, (last.pred / t) * 100) : 0;
  const worst = last ? last.flutes.indexOf(Math.max(...last.flutes)) : -1;
  const yMax = Math.round(t * 1.3);

  // new alert when the level rises (not on first load of a page mid-run)
  useEffect(() => {
    if (!last) { prev.current = null; setAck(0); return; }
    if (prev.current === null) { prev.current = level; return; }
    if (level > prev.current) {
      const id = Date.now();
      setToasts(x => [...x, { id, level, cut: last.cut }]);
      setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 7000);
      if (level === 1 && sound) audio.chime();
    }
    prev.current = level;
  }, [last?.cut, level]);

  // repeating alarm until acknowledged
  useEffect(() => {
    if (!alarm || !sound) return;
    audio.alarm();
    const id = setInterval(audio.alarm, 1500);
    return () => clearInterval(id);
  }, [alarm, sound]);

  useEffect(() => { document.title = alarm ? `ALARM · ${L.label} · ToolSense` : "ToolSense"; }, [alarm, level]);

  const changeSpeed = d => { setS(x => ({ ...x, delay: d })); post("simulation/speed", { delay: d }).then(setS); };
  const start = () => { audio.unlock(); post("simulation/start", { delay: s.delay }).then(setS); };
  const toggleSound = () => { audio.unlock(); const v = !sound; setSound(v); store.set("ts-sound", v ? "on" : "off"); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Logo size={34} /><div><b>ToolSense</b><small>Tool condition monitoring</small></div></div>
        <div className="actions">
          <div className="seg" role="group" aria-label="Replay speed">
            {SPEEDS.map(([n, v]) => <button key={v} className={s.delay === v ? "on" : ""} onClick={() => changeSpeed(v)}>{n}</button>)}
          </div>
          {s.running
            ? <button className="btn" onClick={() => post("simulation/pause").then(setS)}>Pause</button>
            : <button className="btn primary" disabled={done} onClick={start}>{s.index ? "Resume" : "Start"}</button>}
          <button className="btn" onClick={() => post("simulation/reset").then(setS)}>Reset</button>
          <button className={`btn ${sound ? "" : "muted"}`} onClick={toggleSound} aria-pressed={sound}>Alarm sound: {sound ? "On" : "Off"}</button>
        </div>
      </header>

      <div className="strip">
        <span className="chip">Cutter C6 · CNC milling</span>
        <span className={`conn ${live ? "up" : live === false ? "down" : ""}`}>{live ? "Connected" : live === false ? "Reconnecting…" : "Connecting…"}</span>
        <div className="prog"><i style={{ width: `${(s.index / s.total) * 100}%` }} /></div>
        <span className="chip plain">Cut {s.index} of {s.total}{done ? " · complete" : s.running ? " · running" : ""}</span>
      </div>

      {alarm && (
        <div className="alarm" role="alert">
          <div><b>{L.label.toUpperCase()}</b> · cut {last.cut} · {fmt(last.pred)} µm<span>{L.text}</span></div>
          <button className="btn light" onClick={() => setAck(level)}>Acknowledge</button>
        </div>
      )}
      {s.error && <div className="notice">Simulation stopped: {s.error}. Press Resume to continue.</div>}

      <section className={`panel status ${tone}`}>
        <div className="state">
          <span className="eyebrow">Tool condition</span>
          <h2>{last ? L.label : "Standby"}</h2>
          <p>{last ? L.text : "Press Start to begin the simulation."}</p>
        </div>
        <dl className="metrics">
          <div><dt>Max wear</dt><dd>{fmt(last?.pred)}<u>µm</u></dd><small>Measured {fmt(last?.actual)} µm</small></div>
          <div><dt>Wear limit used</dt><dd>{last ? fmt(used, 0) : "—"}<u>%</u></dd><small>Limit {t} µm</small></div>
          <div><dt>Remaining life</dt><dd>{last?.rul != null ? last.rul : "—"}<u>cuts</u></dd><small>{last && last.rul == null ? "Needs 30 cuts" : "Before the limit"}</small></div>
          <div><dt>Current cut</dt><dd>{last ? last.cut : "—"}<u>/ {s.total}</u></dd><small>Replay of cutter C6</small></div>
        </dl>
      </section>

      <div className="cols">
        <div className="stack">
          <section className="panel">
            <div className="ph"><span className="eyebrow">Tool wear</span>
              <span className="legend"><i className="k pred" />Predicted<i className="k act" />Measured</span></div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <ReferenceArea y1={0} y2={t * 0.6} fill="#1a7f4b" fillOpacity={0.06} />
                <ReferenceArea y1={t * 0.6} y2={t * 0.85} fill="#b45309" fillOpacity={0.08} />
                <ReferenceArea y1={t * 0.85} y2={yMax} fill="#c62828" fillOpacity={0.07} />
                <CartesianGrid stroke="#eceef2" vertical={false} />
                <XAxis dataKey="cut" {...ax} /><YAxis domain={[0, yMax]} allowDataOverflow unit=" µm" {...ax} width={58} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #dfe2e7" }} />
                <ReferenceLine y={t} stroke="#c62828" strokeDasharray="5 4" label={{ value: `Limit ${t} µm`, fill: "#c62828", fontSize: 11, position: "insideTopLeft" }} />
                <Line dataKey="actual" name="Measured" stroke="#8a93a3" strokeDasharray="4 3" dot={false} strokeWidth={1.75} connectNulls isAnimationActive={false} />
                <Line dataKey="pred" name="Predicted" stroke="#1f4fd8" dot={false} strokeWidth={2.25} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="note">Shaded zones: Normal below {Math.round(t * 0.6)} µm, Warning to {Math.round(t * 0.85)} µm, Critical above.</p>
          </section>

          <section className="panel">
            <div className="ph"><span className="eyebrow">Remaining useful life</span></div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#eceef2" vertical={false} />
                <XAxis dataKey="cut" {...ax} /><YAxis unit=" cuts" {...ax} width={64} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #dfe2e7" }} />
                <Line dataKey="rul" name="RUL" stroke="#14181f" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="ph"><span className="eyebrow">Cutting edges</span></div>
            <p className="note first">The cutter has three cutting edges, called flutes. Each wears separately, and tool life is set by the worst one.</p>
            <ul className="flutes">
              {[0, 1, 2].map(i => {
                const w = last?.flutes[i] ?? 0;
                return (
                  <li key={i}>
                    <div className="fl"><span>Flute {i + 1}{i === worst && <em>Worst</em>}</span><b>{last ? fmt(w) : "—"} µm</b></div>
                    <div className="bar"><i className={last ? zone(w, t) : ""} style={{ width: `${Math.min(100, (w / t) * 100)}%` }} /></div>
                    <small>Measured {fmt(last?.actualFlutes?.[i])} µm</small>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel">
            <div className="ph"><span className="eyebrow">Alerts</span><small className="count">{events.length || "None"}</small></div>
            {events.length ? (
              <ul className="events">
                {events.map(e => (
                  <li key={e.level} className={LEVELS[e.level].tone}>
                    <b>{LEVELS[e.level].label}</b><span>Cut {e.cut} · {fmt(e.wear)} µm</span>
                    <small>{LEVELS[e.level].text}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="note first">No alerts. All readings are within limits.</p>}
          </section>
        </div>
      </div>

      <div className="cols even">
        <section className="panel">
          <div className="ph"><span className="eyebrow">Sensor inputs, current cut</span></div>
          <div className="inputs">
            {last ? Object.entries(last.inputs).map(([k, v]) => <div key={k}><small>{k.replace(/_/g, " ")}</small><b>{Number(v).toPrecision(4)}</b></div>)
                  : <p className="note first">No data yet.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="ph"><span className="eyebrow">Recent cuts</span></div>
          <div className="tw"><table>
            <thead><tr><th>Cut</th><th>F1</th><th>F2</th><th>F3</th><th>Max</th><th>RUL</th><th>Status</th></tr></thead>
            <tbody>
              {rows.slice(-6).reverse().map(r => { const l = levelOf(r, t); return (
                <tr key={r.cut}><td>{r.cut}</td>{r.flutes.map((f, i) => <td key={i}>{fmt(f)}</td>)}<td>{fmt(r.pred)}</td><td>{r.rul ?? "—"}</td>
                  <td><span className={`pill ${LEVELS[l].tone}`}>{LEVELS[l].label}</span></td></tr>); })}
              {!rows.length && <tr><td colSpan="7" className="empty">No data yet</td></tr>}
            </tbody>
          </table></div>
        </section>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map(x => <div key={x.id} className={`toast ${LEVELS[x.level].tone}`}><b>{LEVELS[x.level].label}</b><span>Cut {x.cut}. {LEVELS[x.level].text}</span></div>)}
      </div>
    </div>
  );
}