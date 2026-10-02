import { redirect } from "next/navigation";

/** "Conteúdo dos módulos" agora vive dentro de Admin > Estrutura das trilhas (botão Material de cada módulo). */
export default function ConteudoRedirectPage() {
  redirect("/admin/estrutura");
}
