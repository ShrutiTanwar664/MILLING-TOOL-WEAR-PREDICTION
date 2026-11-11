import Svg, { Rect, G, Path, Circle } from "react-native-svg";

// Three-flute end mill seen from the tip.
export default function Logo({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="7" fill="#14181f" />
      <G fill="#fff" transform="translate(16 16)">
        {[0, 120, 240].map(a => <Path key={a} transform={`rotate(${a})`} d="M0 0C0-5 2.5-9 7-10 7.5-5 4.5-1 0 0Z" />)}
      </G>
      <Circle cx="16" cy="16" r="2" fill="#14181f" />
    </Svg>
  );
}
