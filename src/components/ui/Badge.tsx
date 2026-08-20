import { theme } from "@/lib/ui/theme";

type Tone = "primary" | "neutral" | "warning" | "danger";

const tones: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: theme.color.primaryLight, fg: theme.color.primaryDark },
  neutral: { bg: theme.color.infoBg, fg: theme.color.infoText },
  warning: { bg: theme.color.warningBg, fg: theme.color.warning },
  danger: { bg: theme.color.dangerBg, fg: theme.color.danger },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: theme.radius.pill,
        fontSize: theme.font.size.xs,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
