"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";

export function InteresseForm({
  vacancies,
  initialSelected,
}: {
  vacancies: Array<{ id: string; nome: string }>;
  initialSelected: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(ids: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/recrutamento/interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacancyIds: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível salvar agora.");
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm, marginBottom: theme.space(3) }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: theme.space(4) }}>
        {vacancies.map((v) => {
          const checked = selected.has(v.id);
          return (
            <label
              key={v.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: checked ? theme.color.primaryLight : theme.color.surface,
                border: `1px solid ${checked ? theme.color.primary : theme.color.border}`,
                borderRadius: theme.radius.lg,
                cursor: "pointer",
                minHeight: 52,
                fontSize: theme.font.size.md,
                color: theme.color.text,
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(v.id)} disabled={saving} style={{ width: 18, height: 18 }} />
              {v.nome}
            </label>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button onClick={() => save([...selected])} disabled={saving || selected.size === 0}>
          {saving ? "Salvando..." : "Salvar e continuar"}
        </Button>
        <Button variant="secondary" onClick={() => save([])} disabled={saving}>
          Ainda não sei
        </Button>
      </div>
    </div>
  );
}
