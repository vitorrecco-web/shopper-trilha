"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { theme } from "@/lib/ui/theme";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        padding: "8px 14px",
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.surface,
        color: theme.color.textMuted,
        fontSize: theme.font.size.sm,
        fontWeight: 600,
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
