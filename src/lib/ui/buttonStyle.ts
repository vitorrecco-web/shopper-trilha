import { theme } from "@/lib/ui/theme";

/**
 * BUG REAL ENCONTRADO E CORRIGIDO: `buttonStyle` vivia dentro de
 * `Button.tsx`, que tem `"use client"` no topo. Quando um Server
 * Component (ex: `/admin/usuarios/page.tsx`) importa QUALQUER coisa de
 * um módulo marcado `"use client"`, o Next trata o módulo inteiro como
 * fronteira de cliente. Para um componente React isso funciona (vira
 * uma referência especial, resolvida na hidratação) — mas para uma
 * função utilitária comum, que precisa EXECUTAR de verdade durante o
 * render no servidor (aqui, calcular um objeto de estilo), essa
 * substituição quebra silenciosamente, e chamar a função gerava
 * exatamente `TypeError: f is not a function` no bundle de produção.
 *
 * Por isso esse arquivo NÃO tem `"use client"` — `buttonStyle` é uma
 * função pura (sem hooks, sem nada específico de cliente) e pode ser
 * chamada tanto de Server quanto de Client Components sem problema.
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export const buttonBaseStyle: React.CSSProperties = {
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

export const buttonVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: theme.color.primary, color: "#fff" },
  secondary: { background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.border}` },
  danger: { background: theme.color.dangerBg, color: theme.color.danger, border: `1px solid ${theme.color.danger}` },
  ghost: { background: "transparent", color: theme.color.textMuted, border: `1px solid transparent` },
};

/** Para usar com next/link (navegação client-side) OU em Server Components: <Link style={buttonStyle("primary")}>. */
export function buttonStyle(variant: ButtonVariant = "primary", disabled?: boolean): React.CSSProperties {
  return {
    ...buttonBaseStyle,
    ...buttonVariantStyles[variant],
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer",
    textDecoration: "none",
  };
}
