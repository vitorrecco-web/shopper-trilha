import { theme } from "@/lib/ui/theme";

/**
 * Gráficos leves (CSS puro, sem dependência): servem tanto em Server quanto
 * em Client Components. Todos usam a escala 0–100 quando falam de nota.
 */

export type BarTone = "primary" | "warning" | "danger" | "neutral";

const toneColor: Record<BarTone, string> = {
  primary: theme.color.primary,
  warning: "#E0A800",
  danger: theme.color.danger,
  neutral: theme.color.textFaint,
};

/**
 * Barra de nota (0–100) com marcador opcional — ex.: "tirou 65" e um traço em
 * 80 (o mínimo exigido). `marker2` é um segundo traço mais discreto (ex.: a
 * média, quando a barra mostra a melhor tentativa).
 */
export function ScoreBar({
  value,
  marker,
  marker2,
  tone = "primary",
  height = 10,
}: {
  value: number | null;
  marker?: number | null;
  marker2?: number | null;
  tone?: BarTone;
  height?: number;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tick = (at: number, color: string, w: number, label: string) => (
    <div
      title={label}
      style={{
        position: "absolute",
        left: `${Math.max(0, Math.min(100, at))}%`,
        top: -3,
        bottom: -3,
        width: w,
        marginLeft: -w / 2,
        background: color,
        borderRadius: 1,
      }}
    />
  );
  return (
    <div style={{ position: "relative", height, background: theme.color.border, borderRadius: height / 2 }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: value === null ? "transparent" : toneColor[tone],
          borderRadius: height / 2,
          transition: "width 0.3s",
        }}
      />
      {marker !== null && marker !== undefined && tick(marker, theme.color.text, 2, `Mínimo exigido: ${marker}`)}
      {marker2 !== null && marker2 !== undefined && tick(marker2, theme.color.textMuted, 2, `Média: ${marker2}`)}
    </div>
  );
}

export interface HBarRow {
  key: string;
  label: React.ReactNode;
  value: number | null;
  /** Texto à direita (padrão: o valor). */
  valueLabel?: React.ReactNode;
  marker?: number | null;
  marker2?: number | null;
  tone?: BarTone;
}

/** Lista de barras horizontais com rótulo à esquerda e valor à direita. */
export function HBars({ rows, labelWidth = 200 }: { rows: HBarRow[]; labelWidth?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: labelWidth, maxWidth: "100%", fontSize: 13, color: theme.color.text }}>{r.label}</div>
          <div style={{ flex: "1 1 160px", minWidth: 120 }}>
            <ScoreBar value={r.value} marker={r.marker} marker2={r.marker2} tone={r.tone} />
          </div>
          <div style={{ width: 90, textAlign: "right", fontSize: 13, fontWeight: 600, color: theme.color.text }}>
            {r.valueLabel ?? (r.value === null ? "—" : r.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface StackSegment {
  key: string;
  label: string;
  value: number;
  tone: BarTone;
}

/** Barra empilhada (partes de um total) com legenda — ex.: atinge / quase / abaixo. */
export function StackedBar({ segments, showLegend = true }: { segments: StackSegment[]; showLegend?: boolean }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: theme.color.border }}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.key}
                title={`${s.label}: ${s.value}`}
                style={{ width: `${(s.value / total) * 100}%`, background: toneColor[s.tone] }}
              />
            ))}
      </div>
      {showLegend && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          {segments.map((s) => (
            <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: theme.color.textMuted }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: toneColor[s.tone], display: "inline-block" }} />
              {s.label}: <b style={{ color: theme.color.text }}>{s.value}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ColumnBin {
  key: string;
  label: string;
  count: number;
  tone?: BarTone;
}

/** Colunas verticais (histograma). */
export function ColumnChart({ bins, height = 120 }: { bins: ColumnBin[]; height?: number }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: height + 34 }}>
      {bins.map((b) => (
        <div key={b.key} style={{ flex: 1, minWidth: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.color.text }}>{b.count}</span>
          <div
            title={`${b.label}: ${b.count}`}
            style={{
              width: "100%",
              height: Math.max(b.count === 0 ? 2 : 6, (b.count / max) * height),
              background: toneColor[b.tone ?? "primary"],
              opacity: b.count === 0 ? 0.25 : 1,
              borderRadius: "4px 4px 0 0",
            }}
          />
          <span style={{ fontSize: 11, color: theme.color.textFaint, whiteSpace: "nowrap" }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Nota de corte vs nota tirada, em uma linha: "65 / mín. 80". */
export function ScoreVsCutoff({ score, cutoff }: { score: number | null; cutoff: number }) {
  const ok = score !== null && score >= cutoff;
  return (
    <span style={{ fontSize: 13 }}>
      <b style={{ color: score === null ? theme.color.textFaint : ok ? theme.color.primaryDark : theme.color.danger }}>
        {score === null ? "—" : String(score).replace(".", ",")}
      </b>
      <span style={{ color: theme.color.textMuted }}> / mín. {String(cutoff).replace(".", ",")}</span>
    </span>
  );
}
