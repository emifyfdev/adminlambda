"use client";

import { useMemo, useState } from "react";
import type { SellerRow } from "@/lib/repos/sellers-repo";
import {
  createSeller,
  updateSeller,
  deleteSeller,
} from "@/lib/repos/sellers-repo";
import { SALES_TEAMS, type SalesTeam } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Pencil } from "lucide-react";

type Props = {
  sellersIniciales: SellerRow[];
};

type SellerStatus = "active" | "inactive";

type FormState = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  sales_team: SalesTeam;
  status: SellerStatus;
};

function toForm(s?: SellerRow): FormState {
  const t = s?.sales_team;
  const safeTeam =
    t && SALES_TEAMS.includes(t as any) ? (t as SalesTeam) : "GENERAL";

  return {
    id: s?.id,
    name: s?.name ?? "",
    email: s?.email ?? "",
    phone: s?.phone ?? "",
    sales_team: safeTeam,
    status: (s?.status ?? "active") as SellerStatus,
  };
}

export default function SellersContent({ sellersIniciales }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(toForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sellersIniciales;
    return sellersIniciales.filter((v) => {
      const hay =
        `${v.name ?? ""} ${v.email ?? ""} ${v.phone ?? ""} ${v.sales_team ?? ""} ${v.status ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [sellersIniciales, q]);

  function openCreate() {
    setErr(null);
    setMode("create");
    setForm(toForm());
    setOpen(true);
  }

  function openEdit(s: SellerRow) {
    setErr(null);
    setMode("edit");
    setForm(toForm(s));
    setOpen(true);
  }

  function validate(f: FormState) {
    if (!f.name.trim()) return "El nombre es obligatorio.";
    // email opcional, pero si lo cargan, validación básica
    if (f.email.trim() && !f.email.includes("@")) return "Email inválido.";
    return null;
  }

  async function onSave() {
    setErr(null);
    const v = validate(form);
    if (v) return setErr(v);

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        sales_team: form.sales_team,
        status: form.status,
      };

      const res =
        mode === "create"
          ? await createSeller(payload)
          : await updateSeller({ id: form.id!, ...payload });

      if (!res.ok) return setErr(res.error);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setDeleting(true);
    try {
      const res = await deleteSeller(id);
      if (!res.ok) return setErr(res.error);
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registros</CardTitle>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo vendedor
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar por nombre, email, celular o equipo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
            <div className="text-sm text-muted-foreground">
              {filtered.length} / {sellersIniciales.length}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <Table className="w-full text-sm">
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-3 text-left">Nombre</TableHead>
                    <TableHead className="p-3 text-left">Email</TableHead>
                    <TableHead className="p-3 text-left">Celular</TableHead>
                    <TableHead className="p-3 text-left">Equipo</TableHead>
                    <TableHead className="p-3 text-left">Estado</TableHead>
                    <TableHead className="p-3 text-left w-[160px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="border-t">
                      <TableCell className="p-3 font-medium">
                        {s.name ?? "-"}
                      </TableCell>
                      <TableCell className="p-3">{s.email ?? "-"}</TableCell>
                      <TableCell className="p-3">{s.phone ?? "-"}</TableCell>
                      <TableCell className="p-3">
                        {s.sales_team ?? "-"}
                      </TableCell>
                      <TableCell className="p-3">
                        <Badge
                          variant={
                            s.status === "active" ? "default" : "secondary"
                          }
                        >
                          {s.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmDeleteId(s.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No hay vendedores para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Nuevo vendedor" : "Editar vendedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Email (opcional)</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Celular (opcional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Equipo de ventas</Label>
              <Select
                value={form.sales_team}
                onValueChange={(v) =>
                  setForm({ ...form, sales_team: v as SalesTeam })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {SALES_TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as SellerStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar vendedor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. ¿Querés eliminar este vendedor?
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && onDelete(confirmDeleteId)}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
