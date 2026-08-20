import Link from "next/link";
import { theme } from "@/lib/ui/theme";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Substitui os antigos links textuais "← Voltar" por uma navegação
 * consistente. Item com `href` que não seja o último SEMPRE renderiza
 * como link real (`<a>`) — auditado depois de um relato de regressão
 * em que "Minha Trilha" parecia não navegar. A cor usa
 * `theme.color.primaryDark` (não mais um cinza neutro) e ganha
 * sublinhado no hover via `.breadcrumb-link` em globals.css, para não
 * parecer texto estático.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: theme.font.size.sm,
        marginBottom: theme.space(4),
        flexWrap: "wrap",
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isLink = Boolean(item.href) && !isLast;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: theme.color.textFaint }}>/</span>}
            {isLink ? (
              <Link
                href={item.href!}
                className="breadcrumb-link"
                style={{
                  color: theme.color.primaryDark,
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "4px 2px",
                  margin: "-4px -2px",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? theme.color.text : theme.color.textMuted, fontWeight: isLast ? 600 : 400 }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
