"use client";

import { theme } from "@/lib/ui/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 18px",
  borderRadius: theme.radius.md,
  fontSize: theme.font.size.base,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "opacity 0.15s, background 0.15s",
  minHeight: 40, // área clicável confortável em mobile
};

const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: theme.color.primary, color: "#fff" },
  secondary: { background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.border}` },
  danger: { background: theme.color.dangerBg, color: theme.color.danger, border: `1px solid ${theme.color.danger}` },
  ghost: { background: "transparent", color: theme.color.textMuted, border: `1px solid transparent` },
};

export function Button({
  variant = "primary",
  disabled,
  fullWidth,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...base,
        ...variants[variant],
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    />
  );
}

/** Para usar com next/link (navegação client-side): <Link style={buttonStyle("primary")}>. */
export function buttonStyle(variant: Variant = "primary", disabled?: boolean): React.CSSProperties {
  return {
    ...base,
    ...variants[variant],
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    textDecoration: "none",
  };
}

/** Mesmo visual do Button, mas como <a> simples — para links externos/API (ex: download). */
export function LinkButton({
  variant = "primary",
  style,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return (
    <a
      {...props}
      style={{
        ...base,
        ...variants[variant],
        textDecoration: "none",
        ...style,
      }}
    />
  );
}
