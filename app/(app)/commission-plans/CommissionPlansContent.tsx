"use client"

import { useMemo, useState } from "react"
import type { CommissionPlan, CommissionBase } from "@/lib/repos/commission-plans-repo"
import { createCommissionPlan, updateCommissionPlan } from "@/lib/repos/commission-plans-repo"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Pencil } from "lucide-react"

type Props = {
  plansIniciales: CommissionPlan[]
}

type FormState = {
  id?: string
  name: string
  base_calc: CommissionBase
  default_rate: string // porcentaje en decimal string (ej 0.25)
  active: boolean
}

function toForm(p?: CommissionPlan): FormState {
  return {
    id: p?.id,
    name: p?.name ?? "",
    base_calc: (p?.base_calc ?? "sale") as CommissionBase,
    default_rate: p ? String(p.default_rate ?? 0) : "0.1",
    active: p?.active ?? true,
  }
}

function fmtPercent(rate: number) {
  const pct = Math.round((Number(rate) || 0) * 100)
  return `${pct}%`
}

export default function CommissionPlansContent({ plansIniciales }: Props) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [form, setForm] = useState<FormState>(toForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return plansIniciales
    return plansIniciales.filter((p) => {
      const hay = `${p.name} ${p.base_calc} ${p.active ? "activo" : "inactivo"}`.toLowerCase()
      return hay.includes(s)
    })
  }, [plansIniciales, q])

  const activeCount = useMemo(() => plansIniciales.filter((p) => p.active).length, [plansIniciales])

  function openCreate() {
    setErr(null)
    setMode("create")
    setForm(toForm())
    setOpen(true)
  }

  function openEdit(p: CommissionPlan) {
    setErr(null)
    setMode("edit")
    setForm(toForm(p))
    setOpen(true)
  }

  function validate(f: FormState) {
    if (!f.name.trim()) return "El nombre es obligatorio."
    const r = Number(f.default_rate)
    if (!Number.isFinite(r) || r < 0 || r > 1) return "default_rate debe estar entre 0 y 1 (ej: 0.25)."
    return null
  }

  async function onSave() {
    setErr(null)
    const v = validate(form)
    if (v) return setErr(v)

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        base_calc: form.base_calc,
        default_rate: Number(form.default_rate),
        active: form.active,
      }

      const res =
        mode === "create"
          ? await createCommissionPlan(payload)
          : await updateCommissionPlan({ id: form.id!, ...payload })

      if (!res.ok) return setErr(res.error)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: CommissionPlan) {
    setErr(null)
    setSaving(true)
    try {
      const res = await updateCommissionPlan({
        id: p.id,
        name: p.name,
        base_calc: p.base_calc,
        default_rate: Number(p.default_rate),
        active: !p.active,
      })
      if (!res.ok) setErr(res.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {err ? (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Planes</CardTitle>
            <CardDescription>Total configurados</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{plansIniciales.length}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activos</CardTitle>
            <CardDescription>Disponibles para ventas</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{activeCount}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Acciones</CardTitle>
              <CardDescription>Crear o editar</CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Usá default_rate en decimal (0.25 = 25%).
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Planes de comisión</CardTitle>
            <CardDescription>Gestioná tipos de comisión por venta</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[260px]"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Base</th>
                  <th className="p-3">Tasa</th>
                  <th className="p-3">Activo</th>
                  <th className="p-3 w-[220px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{p.base_calc === "sale" ? "Venta" : "Margen"}</Badge>
                    </td>
                    <td className="p-3">{fmtPercent(Number(p.default_rate))}</td>
                    <td className="p-3">
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <span className="text-xs text-muted-foreground">Activo</span>
                          <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} disabled={saving} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No hay planes para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo plan" : "Editar plan"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label>Base de cálculo</Label>
              <Select
                value={form.base_calc}
                onValueChange={(v) => setForm({ ...form, base_calc: v as CommissionBase })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sobre venta</SelectItem>
                  <SelectItem value="margin">Sobre margen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Default rate (0 a 1)</Label>
              <Input
                inputMode="decimal"
                value={form.default_rate}
                onChange={(e) => setForm({ ...form, default_rate: e.target.value })}
                placeholder="Ej: 0.25"
              />
              <p className="text-xs text-muted-foreground">
                {Number.isFinite(Number(form.default_rate)) ? `Se mostrará como ${fmtPercent(Number(form.default_rate))}` : ""}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Activo</div>
                <div className="text-xs text-muted-foreground">Disponible para seleccionar en ventas</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>

            {err ? (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}