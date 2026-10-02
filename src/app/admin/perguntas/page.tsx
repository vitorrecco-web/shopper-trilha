import { redirect } from "next/navigation";

/** O Editor de Perguntas agora vive dentro de Admin > Estrutura das trilhas (botão Perguntas de cada módulo). */
export default function PerguntasRedirectPage() {
  redirect("/admin/estrutura");
}
