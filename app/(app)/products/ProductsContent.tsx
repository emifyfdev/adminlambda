"use client"

import { useMemo, useState } from "react"
import { PRODUCT_CATEGORIES, type Product, type ProductStatus, type ProductCategory } from "@/lib/types"

import { createProduct, updateProduct, deleteProduct } from "@/lib/repos/products-repo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, Pencil } from "lucide-react"


type Props = {
  productsIniciales: Product[]
}

type FormState = {
  id?: string
  name: string
  category: ProductCategory
  sku: string
  list_price: string
  cost: string
  status: ProductStatus
}

function toForm(p?: Product): FormState {
  const cat = p?.category
  const safeCategory =
    cat && PRODUCT_CATEGORIES.includes(cat as any) ? (cat as ProductCategory) : "RITMO"

  return {
    id: p?.id,
    name: p?.name ?? "",
    category: safeCategory,
    sku: p?.sku ?? "",
    list_price: p ? String(p.list_price) : "",
    cost: p ? String(p.cost) : "",
    status: (p?.status ?? "active") as ProductStatus,
  }
}

export default function ProductsContent({ productsIniciales }: Props) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [form, setForm] = useState<FormState>(toForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return productsIniciales
    return productsIniciales.filter((p) => {
      const hay = `${p.name} ${p.category ?? ""} ${p.sku ?? ""}`.toLowerCase()
      return hay.includes(s)
    })
  }, [productsIniciales, q])

  function openCreate() {
    setErr(null)
    setMode("create")
    setForm(toForm())
    setOpen(true)
  }

  function openEdit(p: Product) {
    setErr(null)
    setMode("edit")
    setForm(toForm(p))
    setOpen(true)
  }

  function validate(f: FormState) {
    if (!f.name.trim()) return "El nombre es obligatorio."
    const lp = Number(f.list_price)
    const c = Number(f.cost)
    if (!Number.isFinite(lp) || lp < 0) return "Precio inválido."
    if (!Number.isFinite(c) || c < 0) return "Costo inválido."
    return null
  }

  async function onSave() {
    setErr(null)
    const v = validate(form)
    if (v) {
      setErr(v)
      return
    }

    setSaving(true)
    try {
   const payload = {
  name: form.name,
  category: form.category,
  sku: form.sku || null,
  list_price: Number(form.list_price),
  cost: Number(form.cost),
  status: form.status,
}

      const res =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct({ id: form.id!, ...payload })

      if (!res.ok) {
        setErr(res.error)
        return
      }

      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    setDeleting(true)
    try {
      const res = await deleteProduct(id)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setConfirmDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Productos</CardTitle>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
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
              placeholder="Buscar por nombre, categoría o SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
            <div className="text-sm text-muted-foreground">
              {filtered.length} / {productsIniciales.length}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Precio</th>
                  <th className="p-3">Costo</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 w-[160px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.category ?? "-"}</td>
                    <td className="p-3">{p.sku ?? "-"}</td>
                    <td className="p-3">${Number(p.list_price).toLocaleString("es-AR")}</td>
                    <td className="p-3">${Number(p.cost).toLocaleString("es-AR")}</td>
                    <td className="p-3">
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>
                        {p.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmDeleteId(p.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Borrar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={7}>
                      No hay productos para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo producto" : "Editar producto"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

        <div className="grid gap-2">
  <Label>Categoría</Label>
  <Select
    value={form.category}
    onValueChange={(v) => setForm({ ...form, category: v as ProductCategory })}
  >
    <SelectTrigger>
      <SelectValue placeholder="Seleccionar..." />
    </SelectTrigger>
    <SelectContent>
      {PRODUCT_CATEGORIES.map((c) => (
        <SelectItem key={c} value={c}>
          {c}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Ej: SKU-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Precio</Label>
                <Input
                  inputMode="decimal"
                  value={form.list_price}
                  onChange={(e) => setForm({ ...form, list_price: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Costo</Label>
                <Input
                  inputMode="decimal"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ProductStatus })}
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
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. ¿Querés eliminar este producto?
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
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
  )
}