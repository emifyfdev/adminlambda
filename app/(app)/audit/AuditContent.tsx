"use client";

import { useMemo, useState } from "react";
import { Search, Eye, ArrowRight } from "lucide-react";
import { formatDateTimeAR } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { AuditLog, AuditAction } from "@/lib/repos/audit-repo";

type Props = {
  logsIniciales: AuditLog[];
};

const actionLabels: Record<AuditAction, string> = {
  INSERT: "Crear",
  UPDATE: "Editar",
  DELETE: "Eliminar",
};

const actionColors: Record<AuditAction, string> = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

function shortUuid(u?: string | null) {
  if (!u) return "—";
  return u.length > 10 ? `${u.slice(0, 8)}…` : u;
}

function JsonDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const allKeys = [
    ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})]),
  ];

  if (allKeys.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos.</p>;
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {allKeys.map((key) => {
        const bVal = before ? JSON.stringify(before[key], null, 2) : undefined;
        const aVal = after ? JSON.stringify(after[key], null, 2) : undefined;
        const changed = bVal !== aVal;

        return (
          <div key={key} className="flex gap-2">
            <span className="w-28 shrink-0 text-muted-foreground">{key}:</span>
            <div className="flex flex-1 flex-col gap-0.5">
              {bVal !== undefined && (
                <span
                  className={`rounded px-1 ${
                    changed
                      ? "bg-red-50 text-red-700 line-through"
                      : "text-muted-foreground"
                  }`}
                >
                  {bVal}
                </span>
              )}
              {aVal !== undefined && (
                <span
                  className={`rounded px-1 ${
                    changed
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {aVal}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AuditContent({ logsIniciales }: Props) {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");
  const [entityFilter, setEntityFilter] = useState<"all" | string>("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [err] = useState<string | null>(null); // dejalo por si después agregás refresh

  const entities = useMemo(() => {
    return [...new Set(logsIniciales.map((l) => l.entity))].sort();
  }, [logsIniciales]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return logsIniciales.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (entityFilter !== "all" && l.entity !== entityFilter) return false;

      if (s) {
        const hay =
          `${l.entity} ${l.entity_id ?? ""} ${l.actor ?? ""} ${l.action}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }

      return true;
    });
  }, [logsIniciales, q, actionFilter, entityFilter]);

  return (
    <div className="p-6 space-y-6">
      {err ? (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Registro</CardTitle>
            <CardDescription>
             
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por entidad, actor o id..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 w-[280px] pl-9 text-sm"
              />
            </div>

            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as any)}
            >
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Crear</SelectItem>
                <SelectItem value="UPDATE">Editar</SelectItem>
                <SelectItem value="DELETE">Eliminar</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={entityFilter}
              onValueChange={(v) => setEntityFilter(v)}
            >
              <SelectTrigger className="h-9 w-[200px] text-sm">
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground">
              {filtered.length} / {logsIniciales.length}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <Table className="w-full text-sm">
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-3 text-left">Fecha</TableHead>
                    <TableHead className="p-3 text-left">Usuario</TableHead>
                    <TableHead className="p-3 text-left">Acción</TableHead>
                    <TableHead className="p-3 text-left">Entidad</TableHead>
                    <TableHead className="p-3 text-left">ID de entidad</TableHead>
                    <TableHead className="p-3 text-left">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id} className="border-t">
                      <TableCell className="pl-4 p-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTimeAR(l.ts)}
                      </TableCell>
                      <TableCell className="p-3 text-sm font-mono text-muted-foreground whitespace-nowrap">
                        {/* {shortUuid(l.actor_name)} */}
                        {l.actor_name}
                      </TableCell>
                      <TableCell className="p-3">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${actionColors[l.action]}`}
                        >
                          {actionLabels[l.action]}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3 text-sm">{l.entity}</TableCell>
                      <TableCell className="p-3 text-sm font-mono text-muted-foreground">
                        {l.entity_id ?? "—"}
                      </TableCell>
                      
                      <TableCell className="pr-4 p-3 text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelected(l)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No hay logs para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

     <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
  <SheetContent className="w-[95vw] sm:w-[520px] md:w-[680px] lg:w-[760px] max-w-[95vw] overflow-hidden p-0">
    {selected && (
      <div className="flex h-[92vh] flex-col">
        {/* Header sticky */}
        <div className="sticky top-0 z-20 border-b bg-background p-4">
          <SheetHeader>
            <SheetTitle>Detalle de auditoría</SheetTitle>
          </SheetHeader>

          {/* Chips rápidos */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={`text-xs ${actionColors[selected.action]}`}
            >
              {actionLabels[selected.action]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {selected.entity}
            </Badge>
            {selected.entity_id ? (
              <Badge variant="outline" className="text-xs font-mono">
                {selected.entity_id.slice(0, 8)}…
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Body scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Resumen */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Actor</div>
                <div className="text-sm font-medium break-words">
                  {selected.actor_name ?? "—"}
                </div>
                {selected.actor_email ? (
                  <div className="text-xs text-muted-foreground break-all">
                    {selected.actor_email}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Fecha</div>
                <div className="text-sm font-medium">
                  {formatDateTimeAR(selected.ts)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Entity ID</div>
                <div className="text-xs font-mono break-all">
                  {selected.entity_id ?? "—"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Log ID</div>
                <div className="text-xs font-mono break-all">
                  {selected.id}
                </div>
              </div>
            </div>
          </div>

          {/* Diff */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-red-600">Antes</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-emerald-600">Después</span>
            </h4>

            <div className="rounded-lg border border-border bg-muted/30">
              {/* El diff tiene su propio scroll para no hacer eterno el sheet */}
              <div className="max-h-[55vh] overflow-auto p-4">
                <JsonDiff before={selected.before} after={selected.after} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-background p-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    )}
  </SheetContent>
</Sheet>
    </div>
  );
}
