import { theme } from "@/lib/ui/theme";

export function Card({
  children,
  style,
  as: Component = "div",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: "div" | "section";
}) {
  return (
    <Component
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.sm,
        padding: theme.space(4),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

/** Card clicável (ex: cards do painel do gestor) — mesmo visual, com hover sutil. */
export function ClickableCard({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.sm,
        padding: theme.space(4),
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      className="clickable-card"
    >
      {children}
    </a>
  );
}
