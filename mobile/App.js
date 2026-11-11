import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, StyleSheet, Platform, StatusBar, useWindowDimensions } from "react-native";
import { snapshot, control } from "./src/api";
import LineChart from "./src/LineChart";
import Logo from "./src/Logo";
import { LEVELS, levelOf, alertEvents } from "./src/alerts";
import { startAlarm, stopAlarm, nudge } from "./src/alarm";

const C = { bg: "#f2f3f5", panel: "#fff", line: "#dfe2e7", ink: "#14181f", muted: "#5f6877", soft: "#8a93a3",
  ok: "#1a7f4b", warn: "#b45309", bad: "#c62828", okBg: "#e8f5ee", warnBg: "#fdf3e3", badBg: "#fdecec" };
const TONE = { ok: [C.ok, C.okBg], warn: [C.warn, C.warnBg], bad: [C.bad, C.badBg], idle: [C.muted, C.panel] };
const SPEEDS = [["Slow", 1000], ["Normal", 500], ["Fast", 150], ["Turbo", 20]];
const zone = (w, t) => (w / t < 0.6 ? "ok" : w / t < 0.85 ? "warn" : "bad");
const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const num = { fontVariant: ["tabular-nums"] };

export default function App() {
  const { width } = useWindowDimensions();
  const chartW = width - 68;
  const [s, setS] = useState({ running: false, index: 0, total: 315, delay: 500, error: null, threshold: 180 });
  const [rows, setRows] = useState([]);
  const [online, setOnline] = useState(null);
  const [sound, setSound] = useState(true);
  const [ack, setAck] = useState(0);
  const [toast, setToast] = useState(null);
  const count = useRef(0), prev = useRef(null);

  useEffect(() => {
    let alive = true, busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const d = await snapshot(count.current);
        if (!alive) return;
        if (d.count < count.current) { count.current = 0; setRows([]); }
        else if (d.readings.length) { count.current = d.count; setRows(r => [...r, ...d.readings]); }
        setS(d.state); setOnline(true);
      } catch { if (alive) setOnline(false); }
      finally { busy = false; }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const act = (a, b) => control(a, b).then(setS).catch(() => setOnline(false));
  const reset = () => { count.current = 0; setRows([]); act("reset"); };
  const speed = d => { setS(x => ({ ...x, delay: d })); act("speed", { delay: d }); };

  const t = s.threshold, last = rows.at(-1);
  const level = last ? levelOf(last, t) : 0;
  const L = LEVELS[level];
  const [fg, bg] = TONE[last ? L.tone : "idle"];
  const alarm = level >= 2 && ack < level;
  const events = useMemo(() => alertEvents(rows, t).reverse(), [rows, t]);
  const done = s.index >= s.total;
  const used = last ? Math.min(100, (last.pred / t) * 100) : 0;
  const worst = last ? last.flutes.indexOf(Math.max(...last.flutes)) : -1;
  const yMax = Math.round(t * 1.3);
  const rulMax = Math.max(50, ...rows.map(r => r.rul ?? 0));

  useEffect(() => {
    if (!last) { prev.current = null; setAck(0); return; }
    if (prev.current === null) { prev.current = level; return; }
    if (level === 1 && prev.current < 1) { nudge(); setToast({ cut: last.cut }); setTimeout(() => setToast(null), 6000); }
    prev.current = level;
  }, [last?.cut, level]);

  useEffect(() => { if (alarm) startAlarm(sound); else stopAlarm(); return stopAlarm; }, [alarm, sound]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={S.content}>
        <View style={S.header}>
          <Logo />
          <View style={{ flex: 1 }}>
            <Text style={S.h1}>ToolSense</Text>
            <Text style={S.muted}>Tool condition monitoring</Text>
          </View>
          <Pressable onPress={() => setSound(v => !v)} style={S.mini}><Text style={S.miniT}>Sound {sound ? "on" : "off"}</Text></Pressable>
        </View>

        <View style={S.strip}>
          <View style={[S.dot, { backgroundColor: online ? C.ok : online === false ? C.bad : C.soft }]} />
          <Text style={S.muted}>{online ? "Connected" : online === false ? "Offline" : "Connecting…"}</Text>
          <Text style={[S.muted, { marginLeft: "auto" }]}>Cutter C6 · Cut {s.index} of {s.total}</Text>
        </View>
        <View style={S.track}><View style={[S.fill, { width: `${(s.index / s.total) * 100}%`, backgroundColor: C.ink }]} /></View>

        {online === false && <Text style={S.notice}>Can't reach the server. It may be waking up, which can take up to a minute.</Text>}
        {!!s.error && <Text style={S.notice}>Simulation stopped: {s.error}. Tap Resume.</Text>}

        <View style={S.row}>
          {s.running ? <Btn label="Pause" onPress={() => act("pause")} />
            : <Btn primary disabled={done} label={s.index ? "Resume" : "Start"} onPress={() => act("start", { delay: s.delay })} />}
          <Btn label="Reset" onPress={reset} />
        </View>
        <View style={S.seg}>
          {SPEEDS.map(([n, v]) => (
            <Pressable key={v} style={[S.segB, s.delay === v && { backgroundColor: C.ink }]} onPress={() => speed(v)}>
              <Text style={[S.segT, s.delay === v && { color: "#fff" }]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[S.panel, { borderLeftWidth: 4, borderLeftColor: last ? fg : C.soft, marginTop: 14 }]}>
          <Text style={S.eyebrow}>Tool condition</Text>
          <Text style={[S.state, { color: last ? fg : C.ink }]}>{last ? L.label : "Standby"}</Text>
          <Text style={S.muted}>{last ? L.text : "Press Start to begin the simulation."}</Text>
          <View style={[S.track, { marginTop: 12 }]}><View style={[S.fill, { width: `${used}%`, backgroundColor: last ? fg : C.soft }]} /></View>
          <Text style={[S.muted, num]}>{last ? `${fmt(used, 0)}% of the ${t} µm wear limit used` : " "}</Text>
        </View>

        <View style={S.grid}>
          <Metric label="Max wear" value={fmt(last?.pred)} unit="µm" sub={`Measured ${fmt(last?.actual)} µm`} />
          <Metric label="Remaining life" value={last?.rul != null ? String(last.rul) : "—"} unit="cuts" sub={last && last.rul == null ? "Needs 30 cuts" : "Before the limit"} />
        </View>

        <Panel title="Cutting edges">
          <Text style={S.muted}>The cutter has three cutting edges, called flutes. Each wears separately, and tool life is set by the worst one.</Text>
          {[0, 1, 2].map(i => {
            const w = last?.flutes[i] ?? 0, c = last ? TONE[zone(w, t)][0] : C.soft;
            return (
              <View key={i} style={S.flute}>
                <View style={S.between}>
                  <Text style={S.label}>Flute {i + 1}{i === worst ? "  ·  worst" : ""}</Text>
                  <Text style={[S.val, num]}>{last ? fmt(w) : "—"} µm</Text>
                </View>
                <View style={S.track}><View style={[S.fill, { width: `${Math.min(100, (w / t) * 100)}%`, backgroundColor: c }]} /></View>
                <Text style={[S.small, num]}>Measured {fmt(last?.actualFlutes?.[i])} µm</Text>
              </View>
            );
          })}
        </Panel>

        <Panel title="Tool wear (µm)">
          <LineChart width={chartW} xMax={s.total} yMax={yMax} limit={t}
            bands={[{ from: 0, to: t * 0.6, color: C.ok }, { from: t * 0.6, to: t * 0.85, color: C.warn }, { from: t * 0.85, to: yMax, color: C.bad }]}
            series={[{ data: rows.map(r => r.actual), color: C.soft, dash: "4 3", w: 1.75 }, { data: rows.map(r => r.pred), color: "#1f4fd8", w: 2.25 }]} />
          <Text style={S.small}>Blue: predicted. Dashed grey: measured. Red line: wear limit.</Text>
        </Panel>

        <Panel title="Remaining useful life (cuts)">
          <LineChart width={chartW} height={160} xMax={s.total} yMax={Math.ceil(rulMax / 50) * 50} series={[{ data: rows.map(r => r.rul), color: C.ink }]} />
        </Panel>

        <Panel title={`Alerts${events.length ? ` (${events.length})` : ""}`}>
          {events.length ? events.map(e => {
            const [f, b] = TONE[LEVELS[e.level].tone];
            return (
              <View key={e.level} style={[S.event, { backgroundColor: b, borderLeftColor: f }]}>
                <Text style={S.label}><Text style={{ fontWeight: "700", color: f }}>{LEVELS[e.level].label}</Text>  ·  cut {e.cut}  ·  {fmt(e.wear)} µm</Text>
                <Text style={S.small}>{LEVELS[e.level].text}</Text>
              </View>
            );
          }) : <Text style={S.muted}>No alerts. All readings are within limits.</Text>}
        </Panel>

        <Panel title="Sensor inputs, current cut">
          <View style={S.wrap}>
            {last ? Object.entries(last.inputs).map(([k, v]) => (
              <View key={k} style={S.inp}><Text style={S.small}>{k.replace(/_/g, " ")}</Text><Text style={[S.val, num]}>{Number(v).toPrecision(4)}</Text></View>
            )) : <Text style={S.muted}>No data yet.</Text>}
          </View>
        </Panel>

        <Panel title="Recent cuts">
          {rows.slice(-5).reverse().map(r => { const l = levelOf(r, t); return (
            <View key={r.cut} style={S.tr}>
              <Text style={[S.td, { flex: 0.6 }, num]}>#{r.cut}</Text>
              <Text style={[S.td, num]}>{fmt(r.pred)} µm</Text>
              <Text style={[S.td, num]}>RUL {r.rul ?? "—"}</Text>
              <Text style={[S.td, { color: TONE[LEVELS[l].tone][0], fontWeight: "600" }]}>{LEVELS[l].label}</Text>
            </View>); })}
          {!rows.length && <Text style={S.muted}>No data yet.</Text>}
        </Panel>
      </ScrollView>

      {toast && <View style={S.toast}><Text style={S.label}>Warning · cut {toast.cut}</Text><Text style={S.small}>{LEVELS[1].text}</Text></View>}

      <Modal visible={alarm} transparent animationType="fade" onRequestClose={() => setAck(level)}>
        <View style={S.scrim}>
          <View style={S.alarmCard}>
            <Text style={S.alarmEye}>ALARM</Text>
            <Text style={S.alarmTitle}>{L.label}</Text>
            <Text style={S.alarmBody}>{L.text}</Text>
            <Text style={[S.alarmBody, num]}>Cut {last?.cut} · {fmt(last?.pred)} µm · RUL {last?.rul ?? "—"} cuts</Text>
            <Pressable style={S.alarmBtn} onPress={() => setAck(level)}><Text style={S.alarmBtnT}>Acknowledge</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Panel = ({ title, children }) => <View style={S.panel}><Text style={[S.eyebrow, { marginBottom: 8 }]}>{title}</Text>{children}</View>;
const Metric = ({ label, value, unit, sub }) => (
  <View style={[S.panel, { flex: 1 }]}>
    <Text style={S.label}>{label}</Text>
    <Text style={[S.stat, num]}>{value}<Text style={S.unit}> {unit}</Text></Text>
    <Text style={S.small}>{sub}</Text>
  </View>
);
const Btn = ({ label, onPress, primary, disabled }) => (
  <Pressable disabled={disabled} onPress={onPress} style={[S.btn, primary && { backgroundColor: C.ink, borderColor: C.ink }, disabled && { opacity: 0.45 }]}>
    <Text style={[S.btnT, primary && { color: "#fff" }]}>{label}</Text>
  </Pressable>
);

const S = StyleSheet.create({
  content: { padding: 16, paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 56 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  h1: { fontSize: 20, fontWeight: "600", color: C.ink }, muted: { color: C.muted, fontSize: 13, marginTop: 2 },
  mini: { borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel },
  miniT: { fontSize: 12, color: C.ink, fontWeight: "500" },
  strip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 5, backgroundColor: C.line, borderRadius: 3, overflow: "hidden", marginTop: 4 }, fill: { height: "100%" },
  notice: { backgroundColor: C.badBg, borderColor: "#f1c4c4", borderWidth: 1, color: "#8a1c1c", padding: 10, borderRadius: 8, marginTop: 10, fontSize: 13 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, alignItems: "center", justifyContent: "center" },
  btnT: { fontWeight: "600", color: C.ink },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 8, overflow: "hidden", backgroundColor: C.panel, marginTop: 10 },
  segB: { flex: 1, paddingVertical: 9, alignItems: "center" }, segT: { fontSize: 13, color: C.muted, fontWeight: "500" },
  panel: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 12 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 0.9, textTransform: "uppercase", color: C.muted },
  state: { fontSize: 30, fontWeight: "600", marginVertical: 2 },
  grid: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, color: C.ink }, small: { fontSize: 12, color: C.soft, marginTop: 2 },
  stat: { fontSize: 26, fontWeight: "600", color: C.ink, marginTop: 2 }, unit: { fontSize: 12, fontWeight: "400", color: C.muted },
  val: { fontSize: 15, fontWeight: "600", color: C.ink }, between: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  flute: { paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  event: { borderLeftWidth: 3, borderRadius: 6, padding: 10, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inp: { width: "48%", borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 8 },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eceef2" }, td: { flex: 1, fontSize: 13, color: C.ink },
  toast: { position: "absolute", top: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight || 24) + 6, left: 16, right: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderLeftWidth: 4, borderLeftColor: C.warn, borderRadius: 8, padding: 12, elevation: 6 },
  scrim: { flex: 1, backgroundColor: "rgba(20,24,31,0.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  alarmCard: { width: "100%", backgroundColor: C.bad, borderRadius: 14, padding: 22 },
  alarmEye: { color: "#fff", opacity: 0.85, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  alarmTitle: { color: "#fff", fontSize: 32, fontWeight: "700", marginVertical: 4 }, alarmBody: { color: "#fff", fontSize: 15, marginTop: 6 },
  alarmBtn: { backgroundColor: "#fff", borderRadius: 8, height: 48, alignItems: "center", justifyContent: "center", marginTop: 20 },
  alarmBtnT: { color: C.bad, fontWeight: "700", fontSize: 16 },
});
