import React from "react";
import Svg, { Path, Line, Rect, Text as SText } from "react-native-svg";

// Tiny dependency-free line chart. series: [{ data: (number|null)[], color }]
export default function LineChart({ width, height = 200, xMax, yMax, limit, bands = [], series }) {
  const p = { l: 34, r: 8, t: 8, b: 8 };
  const w = width - p.l - p.r, h = height - p.t - p.b;
  const x = i => p.l + (i / Math.max(1, xMax)) * w;
  const y = v => p.t + h - (Math.min(v, yMax) / yMax) * h;
  const path = data => {
    let d = "", pen = false;
    data.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; pen = true;
    });
    return d;
  };
  return (
    <Svg width={width} height={height}>
      {bands.map((b, i) => <Rect key={i} x={p.l} y={y(b.to)} width={w} height={y(b.from) - y(b.to)} fill={b.color} opacity={0.1} />)}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <React.Fragment key={f}>
          <Line x1={p.l} x2={width - p.r} y1={y(f * yMax)} y2={y(f * yMax)} stroke="#eef0f3" />
          <SText x={p.l - 4} y={y(f * yMax) + 4} fontSize="10" fill="#6b7280" textAnchor="end">{Math.round(f * yMax)}</SText>
        </React.Fragment>
      ))}
      {limit != null && <Line x1={p.l} x2={width - p.r} y1={y(limit)} y2={y(limit)} stroke="#dc2626" strokeDasharray="4 4" />}
      {series.map((s, i) => <Path key={i} d={path(s.data)} stroke={s.color} strokeWidth={s.w || 2} strokeDasharray={s.dash} fill="none" />)}
    </Svg>
  );
}
