import { theme } from "@/lib/ui/theme";

export function Container({
  children,
  maxWidth = 720,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <main
      style={{
        maxWidth,
        margin: "0 auto",
        padding: `${theme.space(5)} ${theme.space(4)} ${theme.space(10)}`,
      }}
    >
      {children}
    </main>
  );
}

/** Wrapper de página completo: fundo claro + header fixo + container. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: theme.color.bg }}>{children}</div>;
}
