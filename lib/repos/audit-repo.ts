// lib/repos/audit-repo.ts
import { createClient } from "@/lib/supabase/server";

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export type AuditLog = {
  id: string;
  ts: string; // timestamptz
  actor: string | null; // uuid
  entity: string; // table name
  entity_id: string | null; // uuid
  action: AuditAction;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  actor_name: string | null; // from users table
  actor_email: string | null; // from users table
};

export async function getAuditLogs(limit = 500): Promise<AuditLog[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, ts, actor, entity, entity_id, action, before, after,actor_name,actor_email")
    .order("ts", { ascending: false })
    .limit(limit);

  if (error) {
    // en server component preferimos no romper UI, pero podés throw si querés
    console.error("getAuditLogs error:", error.message);
    return [];
  }

  return (data ?? []) as AuditLog[];
}