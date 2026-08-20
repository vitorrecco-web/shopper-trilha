import { theme } from "@/lib/ui/theme";

export function ProgressBar({
  percent,
  tone = "primary",
  height = 8,
}: {
  percent: number;
  tone?: "primary" | "warning";
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height,
        borderRadius: theme.radius.pill,
        background: theme.color.border,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped}%`,
          background: tone === "warning" ? theme.color.warning : theme.color.primary,
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}
