import Link from "next/link";
import { theme } from "@/lib/ui/theme";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Substitui os antigos links textuais "← Voltar" por uma navegação consistente. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
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
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: theme.color.textFaint }}>/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} style={{ color: theme.color.textMuted, textDecoration: "none" }}>
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
