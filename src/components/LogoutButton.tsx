"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        borderRadius: 8,
        border: "1px solid #2a2d34",
        background: "transparent",
        color: "#f2f2f2",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
