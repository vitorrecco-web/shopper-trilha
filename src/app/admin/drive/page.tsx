import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { DrivePreviewPanel } from "./DrivePreviewPanel";

export default async function AdminDrivePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/admin" style={{ color: "#9aa0a6" }}>
          ← Painel do Gestor
        </Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Estrutura do Drive</h1>
      <p style={{ color: "#9aa0a6", fontSize: 13, marginBottom: 20 }}>
        Leitura da pasta configurada em <code>GOOGLE_DRIVE_ROOT_FOLDER_ID</code>. Isto é só uma
        prévia — nada é gravado no banco ainda (a sincronização com confirmação é a Fase 5).
      </p>
      <DrivePreviewPanel />
    </main>
  );
}
