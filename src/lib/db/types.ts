/**
 * Tipos espelhando 1:1 o schema em supabase/migrations/0001_init.sql
 * (que por sua vez é uma cópia fiel de DATABASE_SCHEMA.sql do pacote).
 *
 * Não redefinir regras aqui — qualquer mudança de regra deve nascer
 * em PROJECT_CONTEXT.md e ser refletida em uma nova migration primeiro.
 */

export type UserRole = "admin" | "student";
export type UserStatus = "active" | "inactive";
export type PhaseType = "specific_track" | "common";
export type SyncStatus = "preview" | "confirmed" | "completed" | "failed" | "cancelled";
export type SyncEntityType = "track" | "phase" | "module" | "pdf" | "questions";
export type SyncChangeType = "added" | "removed" | "renamed" | "reordered" | "updated" | "warning";

export interface Track {
  id: string;
  drive_folder_id: string;
  nome: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  nome_completo: string;
  matricula: string | null;
  login: string;
  password_hash: string;
  track_id: string | null;
  cd: string | null;
  turno: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Phase {
  id: string;
  drive_folder_id: string;
  nome: string;
  ordem: number;
  phase_type: PhaseType;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type MaterialType = "pdf" | "youtube";

export interface Module {
  id: string;
  phase_id: string;
  track_id: string | null;
  drive_folder_id: string;
  ordem: number;
  nome: string;
  material_type: MaterialType;
  pdf_drive_id: string | null;
  pdf_nome: string | null;
  video_drive_id: string | null;
  video_external_id: string | null;
  video_titulo: string | null;
  questions_drive_id: string | null;
  has_questions: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserModule {
  id: string;
  user_id: string;
  module_id: string;
  unlocked_at: string | null;
  material_accessed: boolean;
  material_accessed_at: string | null;
  completed: boolean;
  completed_at: string | null;
  best_score: number | null;
  /** Percentual máximo já assistido do vídeo (0-100) — nunca regride. */
  video_watched_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  module_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  passed: boolean;
  answers: Record<string, unknown>;
  questions_snapshot: Record<string, unknown>;
  started_at: string;
  submitted_at: string | null;
}

export interface SyncHistory {
  id: string;
  admin_user_id: string | null;
  status: SyncStatus;
  started_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  added_count: number;
  removed_count: number;
  renamed_count: number;
  reordered_count: number;
  warnings_count: number;
  summary: Record<string, unknown>;
}

export interface SyncChange {
  id: string;
  sync_id: string;
  entity_type: SyncEntityType;
  entity_drive_id: string | null;
  change_type: SyncChangeType;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}
