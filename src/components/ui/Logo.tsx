import { theme } from "@/lib/ui/theme";

/**
 * Renderiza public/shopper-logo.png. Se o arquivo não existir (ex: numa
 * cópia do projeto sem o asset), o navegador mostra o `alt` — por isso
 * o alt é sempre "Shopper", nunca vazio, garantindo que o nome da marca
 * apareça mesmo sem a imagem.
 */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/shopper-logo.png"
      alt="Shopper"
      height={height}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

export function BrandWordmark({ size = theme.font.size.lg }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, color: theme.color.text, letterSpacing: -0.2 }}>
      Shopper <span style={{ color: theme.color.primary }}>Trilha</span>
    </span>
  );
}
