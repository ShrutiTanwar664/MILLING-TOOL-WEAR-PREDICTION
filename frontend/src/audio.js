import { useRef } from "react";

// Alarm sounds from the Web Audio API (no audio files). Browsers only allow sound
// after a click, so call unlock() from a button handler (Start, Sound toggle).
export function useAlarmAudio() {
  const ctx = useRef(null);
  const get = () => {
    if (!ctx.current) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx.current = new A(); }
    ctx.current?.resume?.();
    return ctx.current;
  };
  const tone = (c, f, at, dur, vol, type) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.03);
  };
  return {
    unlock: get,
    chime() { const c = get(); if (!c) return; const t = c.currentTime; tone(c, 660, t, 0.25, 0.12, "sine"); tone(c, 880, t + 0.18, 0.35, 0.12, "sine"); },
    alarm() { const c = get(); if (!c) return; const t = c.currentTime; [880, 660, 880].forEach((f, i) => tone(c, f, t + i * 0.3, 0.25, 0.14, "square")); },
  };
}