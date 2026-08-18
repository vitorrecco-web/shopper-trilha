import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getTrilhaViewForUser } from "@/lib/services/trilhaViewService";
import { LogoutButton } from "@/components/LogoutButton";
import { TrilhaAccordion } from "./TrilhaAccordion";

export default async function AppHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  const trilha = await getTrilhaViewForUser(user.id, user.track_id);

  return (
    <main style={{ padding: "16px 16px 40px", maxWidth: 560, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 19, margin: 0 }}>Minha Trilha</h1>
        <LogoutButton />
      </div>

      <TrilhaAccordion trilha={trilha} nome={user.nome_completo} />
    </main>
  );
}
