import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/lib/db/types";

/**
 * Regras vindas de PROJECT_CONTEXT.md §11:
 * - login é único, case-insensitive (garantido pelo índice `users_login_unique` na migration).
 * - matrícula pode repetir.
 * - senha nunca em texto puro — quem chama este repositório já deve passar o hash pronto.
 *
 * Trilha(s)/função(ões) de um usuário NÃO vivem mais aqui — um login pode
 * ter várias matrículas ativas ao mesmo tempo, então isso é
 * `enrollmentsRepository.ts` (tabela `enrollments`), nunca uma coluna
 * única em `users`.
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

/** Usado pela tabela do painel admin (§13). */
export async function listUsersWithTrack(): Promise<User[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").order("nome_completo", { ascending: true });

  if (error) throw error;
  return data as User[];
}

export async function listUsers(filters?: { status?: User["status"] }): Promise<User[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from("users").select("*").order("nome_completo", { ascending: true });

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
 * Campos editáveis segundo §11.4. Matrícula(s)/função(ões) propositalmente
 * de fora — uma matrícula existente não pode ser alterada após criada
 * (ver `enrollmentsRepository.ts`: adicionar uma trilha nova é uma
 * operação diferente de editar uma já existente).
 */
export interface UpdateUserInput {
  nome_completo?: string;
  cd?: string | null;
  turno?: string | null;
  login?: string;
  status?: User["status"];
  role?: User["role"];
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
