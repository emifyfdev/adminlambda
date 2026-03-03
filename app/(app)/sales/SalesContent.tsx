"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { SALES_CHANNELS, type SalesChannel } from "@/lib/types";
import {
  createSaleWithItems,
  getSaleDetail,
  updateSaleStatusAndAddItems,
  type SaleStatus,
} from "@/lib/repos/sales-repo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Pencil } from "lucide-react";

type SellerRowLite = {
  id: string;
  name?: string | null;
  display_name?: string | null;
  sales_team?: string | null;
};

type CommissionPlanLite = {
  id: string;
  name: string;
  base_calc: "sale" | "margin";
  default_rate: number;
};

type SaleRow = {
  id: string;
  sold_at: string;
  seller_id: string;

  customer_name: string | null;
  channel: string | null;
  status: SaleStatus;
  notes: string | null;
  commission_plan_id?: string | null;
  total_net?: number | null;
};

type Props = {
  salesIniciales: SaleRow[];
  products: Product[];
  sellers: SellerRowLite[];
  commissionPlans: CommissionPlanLite[];
};

type ItemForm = {
  product_id: string;
  qty: string;
  unit_price: string;
  discount: string; // % en el form
};

function nowGMTMinus3ForDatetimeLocal() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt3 = new Date(utc - 3 * 60 * 60000);
  return gmt3.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function pct(rate: number) {
  return `${Math.round((Number(rate) || 0) * 100)}%`;
}

export default function SalesContent({
  salesIniciales,
  products,
  sellers,
  commissionPlans,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewErr, setViewErr] = useState<string | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);

  // ✅ NUEVO: Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<SaleStatus>("confirmed");
  const [editItems, setEditItems] = useState<ItemForm[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Step 1
  const [soldAt, setSoldAt] = useState(() => nowGMTMinus3ForDatetimeLocal());
  const [customerName, setCustomerName] = useState("");
  const [channel, setChannel] = useState<SalesChannel>("PUBLICO");
  const [status, setStatus] = useState<SaleStatus>("confirmed");
  const [sellerId, setSellerId] = useState<string>(sellers[0]?.id ?? "");

  // ✅ Comisión
  const [commissionPlanId, setCommissionPlanId] = useState<string>(
    commissionPlans[0]?.id ?? "",
  );

  // Step 2 items
  const [items, setItems] = useState<ItemForm[]>(() => {
    const first = products[0];
    return [
      {
        product_id: first?.id ?? "",
        qty: "1",
        unit_price: first ? String(first.list_price) : "",
        discount: "0",
      },
    ];
  });

  async function openView(saleId: string) {
    setViewErr(null);
    setViewItems([]);
    setViewSaleId(saleId);
    setViewOpen(true);
    setViewLoading(true);
    try {
      const res = await getSaleDetail(saleId);
      if (!res.ok) return setViewErr(res.error);
      setViewItems(res.items);
    } finally {
      setViewLoading(false);
    }
  }

  function openCreate() {
    setErr(null);
    setStep(1);
    setSoldAt(nowGMTMinus3ForDatetimeLocal());
    setCustomerName("");
    setChannel("PUBLICO");
    setStatus("confirmed");
    setSellerId(sellers[0]?.id ?? "");
    setCommissionPlanId(commissionPlans[0]?.id ?? "");

    const first = products[0];
    setItems([
      {
        product_id: first?.id ?? "",
        qty: "1",
        unit_price: first ? String(first.list_price) : "",
        discount: "0",
      },
    ]);

    setOpen(true);
  }

  // ✅ NUEVO: abrir edición
  function openEdit(saleId: string) {
    setEditErr(null);
    setEditSaleId(saleId);

    const sale = salesIniciales.find((x) => x.id === saleId);
    setEditStatus(sale?.status ?? "confirmed");

    // opcional: arrancamos sin ítems a agregar
    setEditItems([]);
    setEditOpen(true);
  }

  const productById = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const sellerById = useMemo(() => {
    return new Map(sellers.map((v) => [v.id, v]));
  }, [sellers]);

  const totals = useMemo(() => {
    let revenue = 0; // neto (con descuento)
    let cost = 0;
    let discountTotal = 0; // monto total descontado
    let grossTotal = 0; // bruto (sin descuento)

    for (const it of items) {
      const p = productById.get(it.product_id);
      const qty = Number(it.qty) || 0;
      const unit = Number(it.unit_price) || 0;
      const pct = Number(it.discount) || 0; // % 0..100

      const gross = qty * unit;
      const disc = (Math.max(0, Math.min(100, pct)) / 100) * gross;
      const line = Math.max(0, gross - disc);

      grossTotal += gross;
      discountTotal += disc;
      revenue += line;
      cost += (p?.cost ?? 0) * qty;
    }

    return {
      revenue,
      cost,
      margin: revenue - cost,
      discountTotal,
      grossTotal,
    };
  }, [items, productById]);

  const selectedPlan = useMemo(() => {
    return commissionPlans.find((p) => p.id === commissionPlanId) ?? null;
  }, [commissionPlans, commissionPlanId]);

  const commissionAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    const base =
      selectedPlan.base_calc === "margin" ? totals.margin : totals.revenue;
    const rate = Number(selectedPlan.default_rate) || 0;
    return Math.max(0, base * rate);
  }, [selectedPlan, totals]);

  const companyProfit = useMemo(() => {
    return totals.revenue - totals.cost - commissionAmount;
  }, [totals, commissionAmount]);

  function validateStep1() {
    if (!soldAt) return "Fecha requerida.";
    if (!sellerId) return "Seleccioná un vendedor.";
    if (!channel) return "Seleccioná un canal.";
    if (!commissionPlanId) return "Seleccioná un tipo de comisión.";
    return null;
  }

  function validateStep2() {
    if (!items.length) return "Agregá al menos 1 ítem.";
    for (const it of items) {
      if (!it.product_id) return "Seleccioná un producto.";
      const qty = Number(it.qty);
      if (!Number.isFinite(qty) || qty <= 0) return "Cantidad inválida.";
      const unit = Number(it.unit_price);
      if (!Number.isFinite(unit) || unit < 0) return "Precio inválido.";
      const dp = Number(it.discount);
      if (!Number.isFinite(dp) || dp < 0 || dp > 100)
        return "Descuento % inválido (0 a 100).";
    }
    return null;
  }

  // ✅ NUEVO: validación items de edición (si agregás)
  function validateEditItems() {
    for (const it of editItems) {
      if (!it.product_id) return "Seleccioná un producto.";
      const qty = Number(it.qty);
      if (!Number.isFinite(qty) || qty <= 0) return "Cantidad inválida.";
      const unit = Number(it.unit_price);
      if (!Number.isFinite(unit) || unit < 0) return "Precio inválido.";
      const dp = Number(it.discount);
      if (!Number.isFinite(dp) || dp < 0 || dp > 100)
        return "Descuento % inválido (0 a 100).";
    }
    return null;
  }

  async function next() {
    setErr(null);
    const v =
      step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (v) return setErr(v);
    setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
  }

  function back() {
    setErr(null);
    setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));
  }

  function addItem() {
    const first = products[0];
    setItems((prev) => [
      ...prev,
      {
        product_id: first?.id ?? "",
        qty: "1",
        unit_price: first ? String(first.list_price) : "",
        discount: "0",
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onChangeItem(idx: number, patch: Partial<ItemForm>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (patch.product_id) {
          const p = productById.get(patch.product_id);
          if (p) next.unit_price = String(p.list_price);
        }
        return next;
      }),
    );
  }

  // ✅ NUEVO: helpers edición
  function addEditItem() {
    const first = products[0];
    setEditItems((prev) => [
      ...prev,
      {
        product_id: first?.id ?? "",
        qty: "1",
        unit_price: first ? String(first.list_price) : "",
        discount: "0",
      },
    ]);
  }

  function removeEditItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onChangeEditItem(idx: number, patch: Partial<ItemForm>) {
    setEditItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (patch.product_id) {
          const p = productById.get(patch.product_id);
          if (p) next.unit_price = String(p.list_price);
        }
        return next;
      }),
    );
  }

  async function onSave() {
    setErr(null);
    const v1 = validateStep1();
    const v2 = validateStep2();
    if (v1 || v2) return setErr(v1 || v2);

    setSaving(true);
    try {
      const res = await createSaleWithItems({
        sale: {
          sold_at: new Date(soldAt).toISOString(),
          seller_id: sellerId,
          customer_name: customerName.trim() || null,
          channel: channel ?? null,
          status,
          notes: null,
          commission_plan_id: commissionPlanId,
        },
        items: items.map((it) => {
          const qty = Number(it.qty) || 0;
          const unit = Number(it.unit_price) || 0;

          // descuento % (0..100)
          const pct = Math.max(0, Math.min(100, Number(it.discount) || 0));
          const discountAmount = (pct / 100) * (qty * unit);

          return {
            product_id: it.product_id,
            qty,
            unit_price: unit,
            discount: discountAmount, // ✅ guardamos monto en DB
          };
        }),
      });

      if (!res.ok) return setErr(res.error);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // ✅ NUEVO: guardar edición
  async function onSaveEdit() {
    setEditErr(null);
    if (!editSaleId) return;

    const v = validateEditItems();
    if (v) return setEditErr(v);

    setEditSaving(true);
    try {
      const res = await updateSaleStatusAndAddItems({
        saleId: editSaleId,
        status: editStatus,
        items: editItems.map((it) => {
          const qty = Number(it.qty) || 0;
          const unit = Number(it.unit_price) || 0;

          // descuento % -> monto en DB
          const pct = Math.max(0, Math.min(100, Number(it.discount) || 0));
          const discountAmount = (pct / 100) * (qty * unit);

          return {
            product_id: it.product_id,
            qty,
            unit_price: unit,
            discount: discountAmount,
          };
        }),
      });

      if (!res.ok) return setEditErr(res.error);

      setEditOpen(false);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registros</CardTitle>
          <Button
            onClick={openCreate}
            disabled={!products.length || !sellers.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva venta
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {!products.length ? (
            <Alert variant="destructive">
              <AlertDescription>
                No hay productos cargados. Cargá productos antes de crear ventas.
              </AlertDescription>
            </Alert>
          ) : null}

          {!sellers.length ? (
            <Alert variant="destructive">
              <AlertDescription>
                No hay vendedores cargados. Cargá vendedores antes de crear ventas.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <Table className="w-full text-sm">
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-3 text-left">Fecha</TableHead>
                    <TableHead className="p-3 text-left">Vendedor</TableHead>
                    <TableHead className="p-3 text-left">Cliente</TableHead>
                    <TableHead className="p-3 text-left">Canal</TableHead>
                    <TableHead className="p-3 text-left">Estado</TableHead>
                    <TableHead className="p-3 text-left">ID</TableHead>
                    <TableHead className="p-3 text-left">Total</TableHead>
                    <TableHead className="p-3 text-left w-[120px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {salesIniciales.map((s) => (
                    <TableRow key={s.id} className="border-t">
                      <TableCell className="p-3 whitespace-nowrap">
                        {new Date(s.sold_at).toLocaleString("es-AR")}
                      </TableCell>

                      <TableCell className="p-3">
                        {(() => {
                          const v = sellerById.get(s.seller_id);
                          const name = v?.name ?? v?.display_name;
                          return name ? (
                            <span className="font-medium">
                              {name}
                              {v?.sales_team ? ` (${v.sales_team})` : ""}
                            </span>
                          ) : (
                            "-"
                          );
                        })()}
                      </TableCell>

                      <TableCell className="p-3">
                        {s.customer_name ?? "-"}
                      </TableCell>
                      <TableCell className="p-3">{s.channel ?? "-"}</TableCell>

                      <TableCell className="p-3 whitespace-nowrap">
                        <Badge
                          variant={
                            s.status === "confirmed" ? "default" : "secondary"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="p-3 font-mono text-xs">
                        {s.id}
                      </TableCell>

                      <TableCell className="p-3 font-medium whitespace-nowrap">
                        {s.total_net != null
                          ? `$${Number(s.total_net).toLocaleString("es-AR")}`
                          : "-"}
                      </TableCell>

                      <TableCell className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openView(s.id)}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(s.id)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {salesIniciales.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No hay ventas registradas.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CREATE */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!w-[88vw] !max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nueva venta</DialogTitle>
          </DialogHeader>

          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Fecha y hora</Label>
                  <Input
                    type="datetime-local"
                    value={soldAt}
                    onChange={(e) => setSoldAt(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as SaleStatus)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmada</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="returned">Devuelta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Cliente</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Canal</Label>
                  <Select
                    value={channel}
                    onValueChange={(v) => setChannel(v as SalesChannel)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Vendedor</Label>
                <Select value={sellerId} onValueChange={setSellerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name ?? s.display_name ?? "Vendedor"}
                        {s.sales_team ? ` (${s.sales_team})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Tipo de comisión</Label>
                <Select
                  value={commissionPlanId}
                  onValueChange={setCommissionPlanId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="%" />
                  </SelectTrigger>
                  <SelectContent>
                    {commissionPlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({pct(p.default_rate)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Comisión aplicada según el tipo de venta.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Ítems</div>
                <Button variant="outline" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar ítem
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-lg border p-3 pr-12"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="grid gap-3 items-end md:grid-cols-[minmax(0,1fr)_80px_108px_80px]">
                      <div className="grid gap-2 min-w-0">
                        <Label>Producto</Label>
                        <Select
                          value={it.product_id}
                          onValueChange={(v) =>
                            onChangeItem(idx, { product_id: v })
                          }
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue
                              className="truncate"
                              placeholder="Seleccionar..."
                            />
                          </SelectTrigger>

                          <SelectContent className="min-w-[420px] max-w-[min(720px,92vw)]">
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="block truncate" title={p.name}>
                                  {p.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Cant.</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={it.qty}
                          onChange={(e) =>
                            onChangeItem(idx, { qty: e.target.value })
                          }
                          className="w-full text-right tabular-nums"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Precio</Label>
                        <Input
                          value={Number(it.unit_price || 0).toLocaleString(
                            "es-AR",
                          )}
                          readOnly
                          disabled
                          className="w-full text-right tabular-nums"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Desc. %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          value={it.discount}
                          onChange={(e) =>
                            onChangeItem(idx, { discount: e.target.value })
                          }
                          className="w-full text-right tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total bruto</span>
                    <span>${totals.grossTotal.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Descuento aplicado</span>
                    <span>${totals.discountTotal.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total venta (neto)</span>
                    <span>${totals.revenue.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Costo</span>
                    <span>${totals.cost.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Comisión vendedor</span>
                    <span>${commissionAmount.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>= Margen empresa</span>
                    <span>${companyProfit.toLocaleString("es-AR")}</span>
                  </div>
                </CardContent>
              </Card>

              {selectedPlan ? (
                <p className="text-xs text-muted-foreground">
                  Comisión: {selectedPlan.name} ({pct(selectedPlan.default_rate)})
                  · Base: {selectedPlan.base_calc === "sale" ? "venta" : "margen"}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="mt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={back} disabled={saving}>
                Atrás
              </Button>
            ) : null}

            {step < 3 ? (
              <Button onClick={next} disabled={saving}>
                Siguiente
              </Button>
            ) : (
              <Button onClick={onSave} disabled={saving}>
                {saving ? "Guardando..." : "Guardar venta"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NUEVO: EDIT */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="!w-[88vw] !max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
          </DialogHeader>

          {editErr ? (
            <Alert variant="destructive">
              <AlertDescription>{editErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as SaleStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="returned">Devuelta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Agregar ítems (opcional)
              </div>
              <Button
                variant="outline"
                onClick={addEditItem}
                disabled={!products.length}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar ítem
              </Button>
            </div>

            {editItems.length ? (
              <div className="space-y-3">
                {editItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-lg border p-3 pr-12"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEditItem(idx)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="grid gap-3 items-end md:grid-cols-[minmax(0,1fr)_80px_108px_80px]">
                      <div className="grid gap-2 min-w-0">
                        <Label>Producto</Label>
                        <Select
                          value={it.product_id}
                          onValueChange={(v) =>
                            onChangeEditItem(idx, { product_id: v })
                          }
                        >
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue
                              className="truncate"
                              placeholder="Seleccionar..."
                            />
                          </SelectTrigger>
                          <SelectContent className="min-w-[420px] max-w-[min(720px,92vw)]">
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="block truncate" title={p.name}>
                                  {p.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Cant.</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={it.qty}
                          onChange={(e) =>
                            onChangeEditItem(idx, { qty: e.target.value })
                          }
                          className="w-full text-right tabular-nums"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Precio</Label>
                        <Input
                          value={Number(it.unit_price || 0).toLocaleString(
                            "es-AR",
                          )}
                          readOnly
                          disabled
                          className="w-full text-right tabular-nums"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Desc. %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          value={it.discount}
                          onChange={(e) =>
                            onChangeEditItem(idx, { discount: e.target.value })
                          }
                          className="w-full text-right tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Cancelar
            </Button>
            <Button onClick={onSaveEdit} disabled={editSaving}>
              {editSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW (sin cambios) */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="!w-[88vw] !max-w-4xl max-h-[84vh] overflow-hidden p-3 sm:p-6">
          <div className="max-h-[calc(84vh-2rem)] overflow-y-auto pr-1">
            <DialogHeader>
              <DialogTitle>Detalle de venta</DialogTitle>
            </DialogHeader>

            {viewErr ? (
              <Alert variant="destructive">
                <AlertDescription>{viewErr}</AlertDescription>
              </Alert>
            ) : null}

            {viewLoading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : (
              <>
                {(() => {
                  const sale = salesIniciales.find((x) => x.id === viewSaleId);
                  const seller = sellers.find((x) => x.id === sale?.seller_id);
                  const plan = commissionPlans.find(
                    (x) => x.id === sale?.commission_plan_id,
                  );

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-0.5">
                          <div className="text-sm text-muted-foreground">
                            Detalle
                          </div>
                          <div className="text-base font-semibold">
                            {seller?.name ?? seller?.display_name ?? "Vendedor"}
                            {seller?.sales_team
                              ? ` (${seller.sales_team})`
                              : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            {sale?.channel ?? "—"}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {sale?.status ?? "—"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {plan
                              ? `${Math.round(Number(plan.default_rate) * 100)}%`
                              : "—%"}
                          </Badge>
                        </div>
                      </div>

                      {(() => {
                        const rate = plan ? Number(plan.default_rate) || 0 : 0;

                        const rows = viewItems.map((it) => {
                          const qty = Number(it.qty) || 0;
                          const unit = Number(it.unit_price) || 0;
                          const disc = Number(it.discount) || 0;
                          const gross = qty * unit;
                          const net = Math.max(0, gross - disc);
                          return { qty, unit, disc, gross, net };
                        });

                        const grossTotal = rows.reduce((a, r) => a + r.gross, 0);
                        const discountTotal = rows.reduce((a, r) => a + r.disc, 0);
                        const netSale =
                          sale?.total_net != null
                            ? Number(sale.total_net)
                            : Math.max(0, grossTotal - discountTotal);
                        const commissionTotal = Math.max(0, netSale * rate);
                        const netCompany = Math.max(0, netSale - commissionTotal);

                        return (
                          <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                              <Card className="shadow-none">
                                <CardContent className="p-4">
                                  <div className="text-xs text-muted-foreground">
                                    Total venta
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold">
                                    ${netSale.toLocaleString("es-AR")}
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="shadow-none">
                                <CardContent className="p-4">
                                  <div className="text-xs text-muted-foreground">
                                    Comisión
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold">
                                    $
                                    {commissionTotal.toLocaleString("es-AR", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="shadow-none">
                                <CardContent className="p-4">
                                  <div className="text-xs text-muted-foreground">
                                    Neto empresa
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold">
                                    $
                                    {netCompany.toLocaleString("es-AR", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
                              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <span className="text-muted-foreground">
                                  Fecha
                                </span>
                                <span className="font-medium">
                                  {sale
                                    ? new Date(sale.sold_at).toLocaleString(
                                        "es-AR",
                                      )
                                    : "—"}
                                </span>
                              </div>

                              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <span className="text-muted-foreground">
                                  Cliente
                                </span>
                                <span className="font-medium">
                                  {sale?.customer_name ?? "—"}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-lg border bg-background overflow-hidden">
                              <div className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <table className="w-full text-sm ">
                                  <thead className="bg-muted/40">
                                    <tr className="text-left">
                                      <th className="p-3 w-[360px]">
                                        Producto
                                      </th>
                                      <th className="p-3 w-[90px] text-right whitespace-nowrap">
                                        Cant.
                                      </th>
                                      <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                        Precio
                                      </th>
                                      <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                        Desc
                                      </th>
                                      <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                        Comisión
                                      </th>
                                      <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                        Total
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody className="tabular-nums">
                                    {(() => {
                                      const netForWeights = rows.reduce(
                                        (a, r) => a + r.net,
                                        0,
                                      );

                                      return (
                                        <>
                                          {viewItems.map((it) => {
                                            const qty = Number(it.qty) || 0;
                                            const unit = Number(it.unit_price) || 0;
                                            const disc = Number(it.discount) || 0;
                                            const gross = qty * unit;
                                            const net = Math.max(0, gross - disc);

                                            const w =
                                              netForWeights > 0
                                                ? net / netForWeights
                                                : 0;
                                            const commLine = commissionTotal * w;

                                            return (
                                              <tr key={it.id} className="border-t">
                                                <td className="p-3 truncate">
                                                  {it.product?.name ?? "-"}
                                                </td>
                                                <td className="p-3 text-right">{qty}</td>
                                                <td className="p-3 text-right ">
                                                  ${unit.toLocaleString("es-AR")}
                                                </td>
                                                <td className="p-3 text-right">
                                                  ${disc.toLocaleString("es-AR")}
                                                </td>
                                                <td className="p-3 text-right">
                                                  $
                                                  {commLine.toLocaleString("es-AR", {
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </td>
                                                <td className="p-3 text-right font-medium">
                                                  ${net.toLocaleString("es-AR")}
                                                </td>
                                              </tr>
                                            );
                                          })}

                                          <tr className="border-t bg-muted/20">
                                            <td className="p-3 font-medium " colSpan={3}>
                                              TOTAL BRUTO
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                              -${discountTotal.toLocaleString("es-AR")}
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                              -$
                                              {commissionTotal.toLocaleString("es-AR", {
                                                maximumFractionDigits: 2,
                                              })}
                                            </td>
                                            <td className="p-3 text-right font-bold">
                                              ${grossTotal.toLocaleString("es-AR")}
                                            </td>
                                          </tr>

                                          <tr className="border-t bg-muted/20">
                                            <td className="p-3 font-medium" colSpan={5}>
                                              = NETO EMPRESA
                                            </td>
                                            <td className="p-3 text-right font-bold">
                                              $
                                              {netCompany.toLocaleString("es-AR", {
                                                maximumFractionDigits: 2,
                                              })}
                                            </td>
                                          </tr>
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
              </>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setViewOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}