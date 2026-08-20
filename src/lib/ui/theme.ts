/**
 * Tokens de design do Shopper Trilha — REDESIGN V1.
 *
 * Fonte única de verdade para cor/espaçamento/raio/sombra. Nenhum
 * componente novo deve ter hex solto inline — sempre importar daqui.
 * Os componentes legados (pré-redesign) ainda podem ter cor inline
 * durante a migração incremental, mas todo componente compartilhado em
 * src/components/ui/ usa só isto.
 */

export const theme = {
  color: {
    // Verde Shopper — ação principal, progresso, estados positivos.
    primary: "#1FA97A",
    primaryDark: "#178C64",
    primaryLight: "#E4F5EE",

    // Superfícies (tema claro).
    bg: "#F7F8F7",
    surface: "#FFFFFF",
    border: "#E4E6E4",
    borderStrong: "#D3D6D3",

    // Texto (grafite/preto).
    text: "#1B1F1D",
    textMuted: "#5C6560",
    textFaint: "#8A928D",

    // Atenção — só para bloqueio/reprovação/erro, nunca decorativo.
    warning: "#B98900",
    warningBg: "#FCF3D9",
    danger: "#C23B3B",
    dangerBg: "#FBE7E7",

    // Informativo neutro (ex: "por trilha", badges informativos).
    infoBg: "#EEF0EE",
    infoText: "#4A5450",
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  },
  space: (n: number) => `${n * 4}px`,
  shadow: {
    sm: "0 1px 2px rgba(15, 23, 20, 0.06)",
    md: "0 2px 8px rgba(15, 23, 20, 0.08)",
  },
  font: {
    size: {
      xs: 12,
      sm: 13,
      base: 14,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
    },
  },
} as const;

export type Theme = typeof theme;
