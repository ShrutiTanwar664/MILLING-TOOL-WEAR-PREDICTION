// Three-flute end mill seen from the tip.
export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="ToolSense">
      <rect width="32" height="32" rx="7" fill="#14181f" />
      <g fill="#fff" transform="translate(16 16)">
        {[0, 120, 240].map(a => <path key={a} transform={`rotate(${a})`} d="M0 0C0-5 2.5-9 7-10 7.5-5 4.5-1 0 0Z" />)}
      </g>
      <circle cx="16" cy="16" r="2" fill="#14181f" />
    </svg>
  );
}
