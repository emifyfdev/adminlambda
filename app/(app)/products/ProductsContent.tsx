"use client";

import { useMemo, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductStatus,
  type ProductCategory,
} from "@/lib/types";

import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/repos/products-repo";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  productsIniciales: Product[];
};

type TierForm = { label: string; price: string };

type FormState = {
  id?: string;
  name: string;
  category: ProductCategory;
  sku: string;
  list_price: string;
  cost: string;
  status: ProductStatus;
  hasComplexityPricing: boolean;
  tiers: TierForm[];
};

const DEFAULT_TIERS: TierForm[] = [
  { label: "Baja", price: "" },
  { label: "Media", price: "" },
  { label: "Alta", price: "" },
];

function toForm(p?: Product): FormState {
  const cat = p?.category;
  const safeCategory =
    cat && PRODUCT_CATEGORIES.includes(cat as any)
      ? (cat as ProductCategory)
      : "RITMO";

  const hasComplexityPricing = p?.has_complexity_pricing ?? false;
  const tiers =
    hasComplexityPricing && p?.complexity_tiers?.length
      ? p.complexity_tiers.map((t) => ({
          label: t.label,
          price: String(t.price),
        }))
      : DEFAULT_TIERS;

  return {
    id: p?.id,
    name: p?.name ?? "",
    category: safeCategory,
    sku: p?.sku ?? "",
    list_price: p ? String(p.list_price) : "",
    cost: p ? String(p.cost) : "",
    status: (p?.status ?? "active") as ProductStatus,
    hasComplexityPricing,
    tiers,
  };
}

export default function ProductsContent({ productsIniciales }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(toForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
const [sortBy, setSortBy] = useState<"name-asc" | "name-desc">("name-asc");
const [categoryFilter, setCategoryFilter] = useState<"all" | ProductCategory>("all");

const filteredAndSorted = useMemo(() => {
  const s = q.trim().toLowerCase();

  // 1) filtro por texto
  let out = !s
    ? [...productsIniciales]
    : productsIniciales.filter((p) => {
        const hay = `${p.name} ${p.category ?? ""} ${p.sku ?? ""}`.toLowerCase();
        return hay.includes(s);
      });

  // 2) filtro por categoría
  if (categoryFilter !== "all") {
    out = out.filter((p) => (p.category ?? "RITMO") === categoryFilter);
  }

  // 3) orden alfabético por nombre
  out.sort((a, b) => {
    const an = (a.name ?? "").toLocaleLowerCase();
    const bn = (b.name ?? "").toLocaleLowerCase();
    return sortBy === "name-asc" ? an.localeCompare(bn) : bn.localeCompare(an);
  });

  return out;
}, [productsIniciales, q, sortBy, categoryFilter]);

  function openCreate() {
    setErr(null);
    setMode("create");
    setForm(toForm());
    setOpen(true);
  }

  function openEdit(p: Product) {
    setErr(null);
    setMode("edit");
    setForm(toForm(p));
    setOpen(true);
  }

  function validate(f: FormState) {
    if (!f.name.trim()) return "El nombre es obligatorio.";
    const c = Number(f.cost);
    if (!Number.isFinite(c) || c < 0) return "Costo inválido.";

    if (f.hasComplexityPricing) {
      if (!f.tiers.length) return "Agregá al menos un nivel de complejidad.";
      for (const t of f.tiers) {
        if (!t.label.trim()) return "Cada nivel necesita un nombre.";
        const p = Number(t.price);
        if (!Number.isFinite(p) || p < 0) return `Precio inválido en "${t.label}".`;
      }
    } else {
      const lp = Number(f.list_price);
      if (!Number.isFinite(lp) || lp < 0) return "Precio inválido.";
    }
    return null;
  }

  async function onSave() {
    setErr(null);
    const v = validate(form);
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    try {
      const tiers = form.hasComplexityPricing
        ? form.tiers.map((t) => ({ label: t.label.trim(), price: Number(t.price) }))
        : null;

      // list_price es obligatorio en la base incluso con niveles de complejidad:
      // usamos el precio más bajo como referencia para listados/ordenamiento.
      const list_price = form.hasComplexityPricing
        ? Math.min(...(tiers ?? []).map((t) => t.price))
        : Number(form.list_price);

      const payload = {
        name: form.name,
        category: form.category,
        sku: form.sku || null,
        list_price,
        cost: Number(form.cost),
        status: form.status,
        has_complexity_pricing: form.hasComplexityPricing,
        complexity_tiers: tiers,
      };

      const res =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct({ id: form.id!, ...payload });

      if (!res.ok) {
        setErr(res.error);
        return;
      }

      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setDeleting(true);
    try {
      const res = await deleteProduct(id);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
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
            Nuevo producto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
  <Input
    placeholder="Buscar por nombre, categoría o SKU..."
    value={q}
    onChange={(e) => setQ(e.target.value)}
    className="max-w-md"
  />

  {/* Orden */}
  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
    <SelectTrigger className="h-9 w-[220px] bg-card text-sm">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="name-asc">Nombre (A → Z)</SelectItem>
      <SelectItem value="name-desc">Nombre (Z → A)</SelectItem>
    </SelectContent>
  </Select>

  {/* Categoría */}
  <Select
    value={categoryFilter}
    onValueChange={(v) => setCategoryFilter(v as any)}
  >
    <SelectTrigger className="h-9 w-[200px] bg-card text-sm">
      <SelectValue placeholder="Categoría" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todas</SelectItem>
      {PRODUCT_CATEGORIES.map((c) => (
        <SelectItem key={c} value={c}>
          {c}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  <div className="text-sm text-muted-foreground">
    {filteredAndSorted.length} / {productsIniciales.length}
  </div>
</div>

          {/* TABLA */}
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <Table className="w-full text-sm">
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-3 text-left">Nombre</TableHead>
                    <TableHead className="p-3 text-left">Categoría</TableHead>
                    <TableHead className="p-3 text-left">SKU</TableHead>
                    <TableHead className="p-3 text-left">Precio</TableHead>
                    <TableHead className="p-3 text-left">Costo</TableHead>
                    <TableHead className="p-3 text-left">Estado</TableHead>
                    <TableHead className="p-3 text-left w-[160px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredAndSorted.map((p) => (
                    <TableRow key={p.id} className="border-t">
                      <TableCell className="p-3 font-medium">
                        {p.name}
                      </TableCell>
                      <TableCell className="p-3">{p.category ?? "-"}</TableCell>
                      <TableCell className="p-3">{p.sku ?? "-"}</TableCell>
                      <TableCell className="p-3 whitespace-nowrap">
                        {p.has_complexity_pricing && p.complexity_tiers?.length ? (
                          <span title="Precio según nivel de complejidad">
                            $
                            {Math.min(
                              ...p.complexity_tiers.map((t) => t.price),
                            ).toLocaleString("es-AR")}{" "}
                            – $
                            {Math.max(
                              ...p.complexity_tiers.map((t) => t.price),
                            ).toLocaleString("es-AR")}
                          </span>
                        ) : (
                          `$${Number(p.list_price).toLocaleString("es-AR")}`
                        )}
                      </TableCell>
                      <TableCell className="p-3 whitespace-nowrap">
                        ${Number(p.cost).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="p-3">
                        <Badge
                          variant={
                            p.status === "active" ? "default" : "secondary"
                          }
                        >
                          {p.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(p)}
                          >
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
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredAndSorted.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No hay productos para mostrar.
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
              {mode === "create" ? "Nuevo producto" : "Editar producto"}
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
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as ProductCategory })
                }
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

            <div className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                id="has-complexity-pricing"
                checked={form.hasComplexityPricing}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    hasComplexityPricing: v === true,
                    tiers: form.tiers.length ? form.tiers : DEFAULT_TIERS,
                  })
                }
              />
              <Label htmlFor="has-complexity-pricing" className="cursor-pointer">
                Tiene niveles de complejidad (ej: Biomodelo)
              </Label>
            </div>

            {form.hasComplexityPricing ? (
              <div className="grid gap-2">
                <Label>Niveles de complejidad</Label>
                <div className="space-y-2">
                  {form.tiers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Nombre (ej: Baja)"
                        value={t.label}
                        onChange={(e) => {
                          const tiers = [...form.tiers];
                          tiers[idx] = { ...tiers[idx], label: e.target.value };
                          setForm({ ...form, tiers });
                        }}
                        className="flex-1"
                      />
                      <Input
                        inputMode="decimal"
                        placeholder="Precio"
                        value={t.price}
                        onChange={(e) => {
                          const tiers = [...form.tiers];
                          tiers[idx] = { ...tiers[idx], price: e.target.value };
                          setForm({ ...form, tiers });
                        }}
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm({
                            ...form,
                            tiers: form.tiers.filter((_, i) => i !== idx),
                          })
                        }
                        disabled={form.tiers.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    setForm({
                      ...form,
                      tiers: [...form.tiers, { label: "", price: "" }],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar nivel
                </Button>
                <p className="text-xs text-muted-foreground">
                  Al cargar una venta con este producto vas a poder elegir el
                  nivel, y (solo para este tipo de producto) sumar adicionales:
                  Impresión 3D (+10%), Modelado (+5%) y Planificación
                  Quirúrgica (+15%), combinables entre sí.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Precio</Label>
                <Input
                  inputMode="decimal"
                  value={form.list_price}
                  onChange={(e) =>
                    setForm({ ...form, list_price: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Costo</Label>
              <Input
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as ProductStatus })
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
            <DialogTitle>Eliminar producto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. ¿Querés eliminar este producto?
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
