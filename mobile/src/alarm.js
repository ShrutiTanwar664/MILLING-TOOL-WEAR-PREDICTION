import { Vibration } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

// Looping alarm sound plus repeating vibration. Everything is wrapped so a sound
// problem never crashes the app (vibration and the on-screen alarm still work).
let player = null, timer = null;
try {
  Promise.resolve(setAudioModeAsync({ playsInSilentMode: true })).catch(() => {});
  player = createAudioPlayer(require("../assets/alarm.wav"));
  player.loop = true;
} catch {}

const buzz = () => Vibration.vibrate([0, 300, 150, 300]);

export function startAlarm(sound) {
  stopAlarm();
  if (sound) { try { player?.seekTo(0); player?.play(); } catch {} }
  buzz();
  timer = setInterval(buzz, 1600);
}
export function stopAlarm() {
  clearInterval(timer); timer = null;
  Vibration.cancel();
  try { player?.pause(); } catch {}
}
export const nudge = () => Vibration.vibrate(200);
