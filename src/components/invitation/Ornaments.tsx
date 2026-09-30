import type { Ornament } from "@/types/invitation";

type IconProps = { size?: number; color?: string; className?: string };

export function PetalIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="12" cy="6.5" rx="3.6" ry="5.5" fill={color} opacity="0.85" transform={`rotate(${r} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.2" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function LeafIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size * 2} height={size} viewBox="0 0 48 24" className={className} aria-hidden>
      <path d="M2 12 H46" stroke={color} strokeWidth="1.2" />
      {[8, 18, 28, 38].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={7} rx="5" ry="2.4" fill={color} opacity={0.7 + i * 0.05} transform={`rotate(-30 ${x} 7)`} />
          <ellipse cx={x + 4} cy={17} rx="5" ry="2.4" fill={color} opacity={0.7 + i * 0.05} transform={`rotate(30 ${x + 4} 17)`} />
        </g>
      ))}
    </svg>
  );
}

export function CloudIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 40 24" className={className} aria-hidden>
      <path d="M8 20 a6 6 0 0 1 1 -12 a8 8 0 0 1 15 -2 a7 7 0 0 1 9 7 a5 5 0 0 1 -1 10 z" fill={color} />
    </svg>
  );
}

export function SparkleIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill={color} />
    </svg>
  );
}

export function StarIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5 l2.9 6.1 6.6.8 -4.9 4.6 1.3 6.5 L12 17.3 6.1 20.5 l1.3-6.5 L2.5 9.4l6.6-.8Z"
        fill={color}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeartIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 21 C5 15.5 2 12 2 8.2 A5 5 0 0 1 12 5.6 A5 5 0 0 1 22 8.2 C22 12 19 15.5 12 21Z" fill={color} />
    </svg>
  );
}

export function KnotIcon({ size = 20, className }: IconProps) {
  // 전통 청홍 매듭
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 40 24" className={className} aria-hidden>
      <circle cx="14" cy="12" r="7" fill="none" stroke="#C8574D" strokeWidth="2.4" />
      <circle cx="26" cy="12" r="7" fill="none" stroke="#4E6FA8" strokeWidth="2.4" />
      <path d="M20 6 v12" stroke="#E0B25A" strokeWidth="2" />
    </svg>
  );
}

export function BalloonIcon({ size = 20, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 20 28" className={className} aria-hidden>
      <ellipse cx="10" cy="9" rx="7.5" ry="8.5" fill={color} />
      <path d="M9 17.5 h2 l-1 2z" fill={color} />
      <path d="M10 19.5 q-3 4 0 8" stroke={color} strokeWidth="1" fill="none" opacity="0.7" />
      <ellipse cx="7.5" cy="6" rx="1.8" ry="2.8" fill="#fff" opacity="0.5" />
    </svg>
  );
}

export function OrnamentIcon({ type, size = 18, color }: { type: Ornament; size?: number; color?: string }) {
  switch (type) {
    case "petal":
      return <PetalIcon size={size} color={color} />;
    case "leaf":
      return <LeafIcon size={size} color={color} />;
    case "cloud":
      return <CloudIcon size={size} color={color} />;
    case "sparkle":
      return <SparkleIcon size={size} color={color} />;
    case "star":
      return <StarIcon size={size} color={color} />;
    case "heart":
      return <HeartIcon size={size} color={color} />;
    case "knot":
      return <KnotIcon size={size} />;
    case "balloon":
      return <BalloonIcon size={size} color={color} />;
    case "line":
      return (
        <svg width={size * 4} height={size} viewBox="0 0 80 20" aria-hidden>
          <path d="M0 10 H32 M48 10 H80" stroke={color ?? "currentColor"} strokeWidth="1" />
          <path d="M40 4 L46 10 L40 16 L34 10Z" fill="none" stroke={color ?? "currentColor"} strokeWidth="1" />
        </svg>
      );
    default:
      return <span className="block h-px w-10" style={{ background: color ?? "currentColor" }} />;
  }
}

/** 섹션 사이 구분 장식 */
export function Divider({ type, color }: { type: Ornament; color: string }) {
  return (
    <div className="flex items-center justify-center py-2" style={{ color }}>
      <OrnamentIcon type={type} color={color} />
    </div>
  );
}
