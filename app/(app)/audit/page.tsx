// app/audit/page.tsx
import { AppTopbar } from "@/components/app-topbar";
import { getAuditLogs } from "@/lib/repos/audit-repo";
import AuditContent from "./AuditContent";

export default async function AuditPage() {
  const logs = await getAuditLogs(500);

  return (
    <>
      <AppTopbar title="Auditoría" />
      <AuditContent logsIniciales={logs} />
    </>
  );
}