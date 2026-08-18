import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/lib/db/types";

/**
 * Regras vindas de PROJECT_CONTEXT.md §11:
 * - login é único, case-insensitive (garantido pelo índice `users_login_unique` na migration).
 * - matrícula pode repetir.
 * - trilha/função não pode ser editada após criação (não expor update de track_id aqui).
 * - senha nunca em texto puro — quem chama este repositório já deve passar o hash pronto.
 */

export async function getUserByLogin(login: string): Promise<User | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("login", login)
    .maybeSingle();

  if (error) throw error;
  return data as User | null;
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data as User | null;
}

export interface UserWithTrack extends User {
  track: { id: string; nome: string } | null;
}

/** Usado pela tabela do painel admin (§13) — já traz o nome da trilha via join. */
export async function listUsersWithTrack(): Promise<UserWithTrack[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*, track:tracks(id, nome)")
    .order("nome_completo", { ascending: true });

  if (error) throw error;
  return data as unknown as UserWithTrack[];
}

export async function getUserWithTrackById(id: string): Promise<UserWithTrack | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*, track:tracks(id, nome)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as UserWithTrack | null;
}

export async function listUsers(filters?: {
  trackId?: string;
  status?: User["status"];
}): Promise<User[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("users").select("*").order("nome_completo", { ascending: true });

  if (filters?.trackId) query = query.eq("track_id", filters.trackId);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data as User[];
}

export interface CreateUserInput {
  nome_completo: string;
  matricula?: string | null;
  login: string;
  password_hash: string;
  track_id: string;
  cd?: string | null;
  turno?: string | null;
  role?: User["role"];
  status?: User["status"];
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      nome_completo: input.nome_completo,
      matricula: input.matricula ?? null,
      login: input.login,
      password_hash: input.password_hash,
      track_id: input.track_id,
      cd: input.cd ?? null,
      turno: input.turno ?? null,
      role: input.role ?? "student",
      status: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Campos editáveis segundo §11.4. `track_id` propositalmente de fora —
 * trilha/função não pode ser alterada após criação.
 */
export interface UpdateUserInput {
  nome_completo?: string;
  cd?: string | null;
  turno?: string | null;
  login?: string;
  status?: User["status"];
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").update(input).eq("id", id).select("*").single();

  if (error) throw error;
  return data as User;
}

export async function updatePasswordHash(id: string, passwordHash: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", id);
  if (error) throw error;
}

export async function touchLastLogin(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
