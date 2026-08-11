"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, SaleItemOptions } from "@/lib/types";
import { SALES_CHANNELS, type SalesChannel } from "@/lib/types";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { COMPLEXITY_ADDONS, type ComplexityAddonKey } from "@/lib/types";
import {
  createSaleWithItems,
  getSaleDetail,
  updateSaleStatusAndAddItems,
  refreshSalePrices,
  updateSaleItemCost,
  assignBudgetNumber,
  type SaleStatus,
} from "@/lib/repos/sales-repo";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Plus,
  Trash2,
  Pencil,
  NotepadText,
  Eye,
  LockKeyhole,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  total_cost?: number | null;
  total_commission?: number | null;
  company_profit?: number | null;
  invoice_number?: string | null;
  budget_number?: number | null;
  budget_issued_at?: string | null;
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
  complexityLabel?: string; // solo productos con niveles de complejidad
  addonKeys?: ComplexityAddonKey[];
};

// Precio de un ítem con niveles de complejidad: precio del nivel elegido +
// los % de los adicionales seleccionados (se suman entre sí).
function computeComplexityUnitPrice(
  product: Product | undefined,
  complexityLabel: string | undefined,
  addonKeys: ComplexityAddonKey[] | undefined,
): number {
  if (!product?.has_complexity_pricing || !product.complexity_tiers?.length) {
    return 0;
  }
  const tier =
    product.complexity_tiers.find((t) => t.label === complexityLabel) ??
    product.complexity_tiers[0];
  const base = Number(tier?.price) || 0;
  const pctSum = (addonKeys ?? []).reduce((sum, key) => {
    const addon = COMPLEXITY_ADDONS.find((a) => a.key === key);
    return sum + (addon?.pct ?? 0);
  }, 0);
  return base * (1 + pctSum);
}

function buildItemOptions(
  product: Product | undefined,
  complexityLabel: string | undefined,
  addonKeys: ComplexityAddonKey[] | undefined,
): SaleItemOptions {
  if (!product?.has_complexity_pricing || !product.complexity_tiers?.length) {
    return null;
  }
  const tier =
    product.complexity_tiers.find((t) => t.label === complexityLabel) ??
    product.complexity_tiers[0];
  if (!tier) return null;

  const addons = (addonKeys ?? [])
    .map((key) => COMPLEXITY_ADDONS.find((a) => a.key === key))
    .filter((a): a is (typeof COMPLEXITY_ADDONS)[number] => !!a)
    .map((a) => ({ key: a.key, label: a.label, pct: a.pct }));

  return { complexity: { label: tier.label, price: Number(tier.price) || 0 }, addons };
}

function describeItemOptions(options: SaleItemOptions | null | undefined) {
  if (!options?.complexity) return null;
  const addonLabels = (options.addons ?? []).map((a) => a.label);
  return addonLabels.length
    ? `${options.complexity.label} + ${addonLabels.join(" + ")}`
    : options.complexity.label;
}

function nowGMTMinus3ForDatetimeLocal() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const gmt3 = new Date(utc - 3 * 60 * 60000);
  return gmt3.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function pct(rate: number) {
  return `${Math.round((Number(rate) || 0) * 100)}%`;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
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

  const [editingCostItemId, setEditingCostItemId] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState("");
  const [costSaving, setCostSaving] = useState(false);

  function openEditCost(item: any) {
    setEditingCostItemId(item.id);
    setCostDraft(String(item.cost_at_sale ?? item.product?.cost ?? 0));
  }

  async function onSaveCost(itemId: string) {
    const cost = Number(costDraft);
    if (!Number.isFinite(cost) || cost < 0) {
      setViewErr("Costo inválido.");
      return;
    }
    setCostSaving(true);
    try {
      const res = await updateSaleItemCost(itemId, cost);
      if (!res.ok) {
        setViewErr(res.error);
        return;
      }
      setEditingCostItemId(null);
      if (viewSaleId) await openView(viewSaleId);
      router.refresh();
    } finally {
      setCostSaving(false);
    }
  }

  // ✅ NUEVO: Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<SaleStatus>("confirmed");
  const [editItems, setEditItems] = useState<ItemForm[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeSaleId, setCloseSaleId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paid, setPaid] = useState(true);
  const [closeSaving, setCloseSaving] = useState(false);
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SaleStatus>("all");
  const [sortBy, setSortBy] = useState<
    "date-desc" | "date-asc" | "total-desc" | "total-asc"
  >("date-desc");

  const [budgetLoadingId, setBudgetLoadingId] = useState<string | null>(null);
  const [budgetErr, setBudgetErr] = useState<string | null>(null);

  function openClose(saleId: string) {
    setCloseErr(null);
    setCloseSaleId(saleId);
    setPaymentMethod("EFECTIVO");
    setInvoiceNumber("");
    setPaid(true);
    setCloseOpen(true);
  }

  // Step 1
  const [soldAt, setSoldAt] = useState(() => nowGMTMinus3ForDatetimeLocal());
  const [customerName, setCustomerName] = useState("");
  const [channel, setChannel] = useState<SalesChannel>("PÚBLICO");
  const [status, setStatus] = useState<SaleStatus>("pending");
  const [sellerId, setSellerId] = useState<string>(sellers[0]?.id ?? "");

  // ✅ Comisión
  const [commissionPlanId, setCommissionPlanId] = useState<string>(
    commissionPlans[0]?.id ?? "",
  );

  function makeDefaultItem(product: Product | undefined): ItemForm {
    if (product?.has_complexity_pricing) {
      const firstTier = product.complexity_tiers?.[0];
      return {
        product_id: product.id,
        qty: "1",
        unit_price: String(
          computeComplexityUnitPrice(product, firstTier?.label, []),
        ),
        discount: "0",
        complexityLabel: firstTier?.label,
        addonKeys: [],
      };
    }
    return {
      product_id: product?.id ?? "",
      qty: "1",
      unit_price: product ? String(product.list_price) : "",
      discount: "0",
    };
  }

  // Step 2 items
  const [items, setItems] = useState<ItemForm[]>(() => [
    makeDefaultItem(products[0]),
  ]);

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
    setChannel("PÚBLICO");
    setStatus("pending");
    setSellerId(sellers[0]?.id ?? "");
    setCommissionPlanId(commissionPlans[0]?.id ?? "");

    setItems([makeDefaultItem(products[0])]);

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

  async function loadImageAsDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleGenerateBudgetPdf(saleId: string) {
    setBudgetErr(null);
    setBudgetLoadingId(saleId);

    try {
      const sale = salesIniciales.find((x) => x.id === saleId);
      if (!sale) {
        setBudgetErr("No se encontró la venta.");
        return;
      }

      const seller = sellers.find((x) => x.id === sale.seller_id);

      const res = await getSaleDetail(saleId);
      if (!res.ok) {
        setBudgetErr(res.error);
        return;
      }

      const detailItems = res.items ?? [];

      const saleDate = new Date(sale.sold_at);
      const expirationDate = new Date(saleDate);
      expirationDate.setDate(expirationDate.getDate() + 15);

      const rows = detailItems.map((it: any) => {
        const qty = Number(it.qty) || 0;
        const unit = Number(it.unit_price) || 0;
        const bonifAmount = Number(it.discount) || 0;
        const gross = qty * unit;
        const bonifPct = gross > 0 ? (bonifAmount / gross) * 100 : 0;
        const total = Math.max(0, gross - bonifAmount);
        const optionsDesc = describeItemOptions(it.options);

        return {
          product: it.product?.name
            ? optionsDesc
              ? `${it.product.name} (${optionsDesc})`
              : it.product.name
            : "Producto",
          qty,
          unit,
          bonifAmount,
          bonifPct,
          total,
        };
      });

      const totalFinal = rows.reduce((acc, r) => acc + r.total, 0);

      const budgetRes = await assignBudgetNumber(sale.id);
      if (!budgetRes.ok) {
        setBudgetErr(budgetRes.error);
        return;
      }

      const budgetNumber = String(budgetRes.budgetNumber);
      const emissionDate = new Date().toLocaleDateString("es-AR");
      const expirationDateText = expirationDate.toLocaleDateString("es-AR");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Logo
      try {
        const logoDataUrl = await loadImageAsDataUrl("/logo-text.png");
        doc.addImage(logoDataUrl, "PNG", 14, 17, 80, 28);
      } catch (e) {
        console.warn("No se pudo cargar el logo del presupuesto.", e);
      }

      // Bloque derecho
      const rightX = 120;
      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(`N° Presupuesto: ${budgetNumber}`, rightX, y);

      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      // doc.text(`N° Presupuesto: ${budgetNumber}`, rightX, y);

      y += 7;
      doc.text(`Fecha de emisión: ${emissionDate}`, rightX, y);

      y += 7;
      doc.text(`Fecha de caducidad: ${expirationDateText}`, rightX, y);

      y += 7;
      doc.text(
        `Cliente: ${sale.customer_name?.trim() ? sale.customer_name : "-"}`,
        rightX,
        y,
      );

      y += 7;
      doc.text(
        `Vendedor: ${seller?.name ?? seller?.display_name ?? "Sin vendedor asignado"}`,
        rightX,
        y,
      );

      y += 7;

      // Línea separadora
      const headerBottomY = Math.max(42, y + 6);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, headerBottomY, pageWidth - 14, headerBottomY);

      const tableStartY = headerBottomY + 8;

      autoTable(doc, {
        startY: tableStartY,
        head: [
          [
            "Producto",
            "Cant.",
            "Precio unit.",
            "Bonif %",
            "Imp. Bonif",
            "Subtotal",
          ],
        ],
        body: rows.map((r) => [
          r.product,
          String(r.qty),
          formatMoney(r.unit),
          `${r.bonifPct.toFixed(0)}%`,
          formatMoney(r.bonifAmount),
          formatMoney(r.total),
        ]),
        styles: {
          fontSize: 10,
          cellPadding: 3,
          overflow: "linebreak",
          valign: "middle",
          textColor: 40,
        },
        headStyles: {
          fillColor: [47, 128, 185],
          textColor: 255,
          fontStyle: "bold",
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { cellWidth: 68, halign: "left" },
          1: { cellWidth: 18, halign: "right" },
          2: { cellWidth: 28, halign: "right" },
          3: { cellWidth: 22, halign: "right" },
          4: { cellWidth: 28, halign: "right" },
          5: { cellWidth: 28, halign: "right" },
        },
        didParseCell(data) {
          if (data.section === "head") {
            if (data.column.index === 0) {
              data.cell.styles.halign = "left";
            } else {
              data.cell.styles.halign = "right";
            }
          }
        },
        margin: { left: 10, right: 14 },
        tableWidth: "auto",
      });

      const finalY =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? tableStartY + 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`PRECIO TOTAL: ${formatMoney(totalFinal)}`, 14, finalY + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "Presupuesto válido por 15 días. Documento no fiscal.",
        14,
        finalY + 24,
      );

      doc.save(`${budgetNumber}.pdf`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setBudgetErr("Ocurrió un error al generar el presupuesto.");
    } finally {
      setBudgetLoadingId(null);
    }
  }

  const productById = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const sellerById = useMemo(() => {
    return new Map(sellers.map((v) => [v.id, v]));
  }, [sellers]);

  const filteredSales = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return salesIniciales;

    return salesIniciales.filter((sale) => {
      const seller = sellerById.get(sale.seller_id);
      const sellerName =
        `${seller?.name ?? ""} ${seller?.display_name ?? ""} ${seller?.sales_team ?? ""}`.trim();

      const hay = [
        sale.id,
        sale.customer_name ?? "",
        sale.channel ?? "",
        sale.status ?? "",
        sellerName,
        new Date(sale.sold_at).toLocaleString("es-AR"),
        sale.total_net != null ? String(sale.total_net) : "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [salesIniciales, q, sellerById]);

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
      totalNetSale: revenue, // antes revenue
      totalCost: cost, // antes cost
      totalMargin: revenue - cost,
      totalDiscount: discountTotal,
      totalGross: grossTotal,
    };
  }, [items, productById]);

  const selectedPlan = useMemo(() => {
    return commissionPlans.find((p) => p.id === commissionPlanId) ?? null;
  }, [commissionPlans, commissionPlanId]);

  const commissionAmount = useMemo(() => {
    if (!selectedPlan) return 0;

    const rate = Number(selectedPlan.default_rate) || 0;

    // Regla:
    // - si plan es "sale": comisión sobre BRUTO (sin descuento)
    // - si plan es "margin": comisión sobre margen (neto - costo)
    const base =
      selectedPlan.base_calc === "margin"
        ? totals.totalMargin
        : totals.totalGross;

    return Math.max(0, base * rate);
  }, [selectedPlan, totals]);

  const companyProfit = useMemo(() => {
    return totals.totalNetSale - totals.totalCost - commissionAmount;
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
    setItems((prev) => [...prev, makeDefaultItem(products[0])]);
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
          if (p?.has_complexity_pricing) {
            const firstTier = p.complexity_tiers?.[0];
            next.complexityLabel = firstTier?.label;
            next.addonKeys = [];
            next.unit_price = String(
              computeComplexityUnitPrice(p, firstTier?.label, []),
            );
          } else {
            next.complexityLabel = undefined;
            next.addonKeys = undefined;
            if (p) next.unit_price = String(p.list_price);
          }
        } else if (
          patch.complexityLabel !== undefined ||
          patch.addonKeys !== undefined
        ) {
          const p = productById.get(next.product_id);
          next.unit_price = String(
            computeComplexityUnitPrice(p, next.complexityLabel, next.addonKeys),
          );
        }

        return next;
      }),
    );
  }

  // ✅ NUEVO: helpers edición
  function addEditItem() {
    setEditItems((prev) => [...prev, makeDefaultItem(products[0])]);
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
          if (p?.has_complexity_pricing) {
            const firstTier = p.complexity_tiers?.[0];
            next.complexityLabel = firstTier?.label;
            next.addonKeys = [];
            next.unit_price = String(
              computeComplexityUnitPrice(p, firstTier?.label, []),
            );
          } else {
            next.complexityLabel = undefined;
            next.addonKeys = undefined;
            if (p) next.unit_price = String(p.list_price);
          }
        } else if (
          patch.complexityLabel !== undefined ||
          patch.addonKeys !== undefined
        ) {
          const p = productById.get(next.product_id);
          next.unit_price = String(
            computeComplexityUnitPrice(p, next.complexityLabel, next.addonKeys),
          );
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
            options: buildItemOptions(
              productById.get(it.product_id),
              it.complexityLabel,
              it.addonKeys,
            ),
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
            options: buildItemOptions(
              productById.get(it.product_id),
              it.complexityLabel,
              it.addonKeys,
            ),
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
                No hay productos cargados. Cargá productos antes de crear
                ventas.
              </AlertDescription>
            </Alert>
          ) : null}

          {!sellers.length ? (
            <Alert variant="destructive">
              <AlertDescription>
                No hay vendedores cargados. Cargá vendedores antes de crear
                ventas.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar por cliente, vendedor, canal o ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
            <div className="text-sm text-muted-foreground">
              {filteredSales.length} / {salesIniciales.length}
            </div>
          </div>
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
                    <TableHead className="p-3 text-left">Total venta</TableHead>
                    <TableHead className="p-3 text-left w-[120px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSales.map((s) => (
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

                      <TableCell className="p-3 font-bold text-green-600 whitespace-nowrap">
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
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(s.id)}
                            disabled={s.status === "confirmed"}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Agregar ítem
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleGenerateBudgetPdf(s.id)}
                            disabled={
                              s.status === "confirmed" ||
                              budgetLoadingId === s.id
                            }
                          >
                            <NotepadText className="mr-2 h-4 w-4" />
                            {budgetLoadingId === s.id
                              ? "Generando..."
                              : "Presupuesto"}
                          </Button>

                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openClose(s.id)}
                            disabled={
                              s.status === "confirmed" ||
                              s.status === "cancelled" ||
                              s.status === "returned"
                            }
                          >
                            <LockKeyhole className="mr-2 h-4 w-4" />
                            Cerrar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredSales.length === 0 ? (
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
          {budgetErr ? (
            <Alert variant="destructive">
              <AlertDescription>{budgetErr}</AlertDescription>
            </Alert>
          ) : null}
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
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="confirmed">Confirmada</SelectItem>
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
                {items.map((it, idx) => {
                  const itemProduct = productById.get(it.product_id);
                  return (
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

                      {itemProduct?.has_complexity_pricing ? (
                        <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
                          <div className="grid gap-2 max-w-xs">
                            <Label>Nivel de complejidad</Label>
                            <Select
                              value={it.complexityLabel}
                              onValueChange={(v) =>
                                onChangeItem(idx, { complexityLabel: v })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(itemProduct.complexity_tiers ?? []).map((t) => (
                                  <SelectItem key={t.label} value={t.label}>
                                    {t.label} (${Number(t.price).toLocaleString("es-AR")})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-wrap gap-4">
                            {COMPLEXITY_ADDONS.map((addon) => {
                              const checked =
                                it.addonKeys?.includes(addon.key) ?? false;
                              return (
                                <label
                                  key={addon.key}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const prevKeys = it.addonKeys ?? [];
                                      const nextKeys = v
                                        ? [...prevKeys, addon.key]
                                        : prevKeys.filter((k) => k !== addon.key);
                                      onChangeItem(idx, { addonKeys: nextKeys });
                                    }}
                                  />
                                  {addon.label} (+{Math.round(addon.pct * 100)}%)
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
                    <span>${totals.totalGross.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Descuento aplicado</span>
                    <span>${totals.totalDiscount.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Comisión vendedor </span>
                    <span>${commissionAmount.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total venta (neto)</span>
                    <span>${totals.totalNetSale.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Costo</span>
                    <span>${totals.totalCost.toLocaleString("es-AR")}</span>
                  </div>

                  <div className="flex justify-between font-medium">
                    <span>= Margen empresa</span>
                    <span>${companyProfit.toLocaleString("es-AR")}</span>
                  </div>
                </CardContent>
              </Card>

              {selectedPlan ? (
                <p className="text-xs text-muted-foreground">
                  Comisión: {selectedPlan.name} (
                  {pct(selectedPlan.default_rate)}) · Base:{" "}
                  {selectedPlan.base_calc === "sale" ? "bruto" : "margen"}
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
            <DialogTitle></DialogTitle>
          </DialogHeader>

          {editErr ? (
            <Alert variant="destructive">
              <AlertDescription>{editErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            {/* <div className="grid gap-2">
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
            </div> */}

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Selecciona el producto
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
                {editItems.map((it, idx) => {
                  const itemProduct = productById.get(it.product_id);
                  return (
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

                      {itemProduct?.has_complexity_pricing ? (
                        <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
                          <div className="grid gap-2 max-w-xs">
                            <Label>Nivel de complejidad</Label>
                            <Select
                              value={it.complexityLabel}
                              onValueChange={(v) =>
                                onChangeEditItem(idx, { complexityLabel: v })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(itemProduct.complexity_tiers ?? []).map((t) => (
                                  <SelectItem key={t.label} value={t.label}>
                                    {t.label} (${Number(t.price).toLocaleString("es-AR")})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-wrap gap-4">
                            {COMPLEXITY_ADDONS.map((addon) => {
                              const checked =
                                it.addonKeys?.includes(addon.key) ?? false;
                              return (
                                <label
                                  key={addon.key}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const prevKeys = it.addonKeys ?? [];
                                      const nextKeys = v
                                        ? [...prevKeys, addon.key]
                                        : prevKeys.filter((k) => k !== addon.key);
                                      onChangeEditItem(idx, { addonKeys: nextKeys });
                                    }}
                                  />
                                  {addon.label} (+{Math.round(addon.pct * 100)}%)
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
        <DialogContent className="!w-[88vw] !max-w-5xl max-h-[84vh] overflow-hidden p-3 sm:p-6">
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
                            Número de factura {sale?.invoice_number}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            N° presupuesto {sale?.budget_number ?? "-"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Emitido:{" "}
                            {sale?.budget_issued_at
                              ? new Date(sale.budget_issued_at).toLocaleString(
                                  "es-AR",
                                )
                              : "-"}
                          </div>
                          <div className="text-base font-semibold">
                            {seller?.name ?? seller?.display_name ?? "Vendedor"}
                            {seller?.sales_team
                              ? ` (${seller.sales_team})`
                              : ""}
                          </div>
                        </div>
                        {sale && sale.status !== "confirmed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const res = await refreshSalePrices(sale.id);
                              if (!res.ok) return setViewErr(res.error);
                              await openView(sale.id);
                              router.refresh();
                            }}
                          >
                            Actualizar precios
                          </Button>
                        ) : null}
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

                          const unitCost =
                            Number(it.cost_at_sale ?? it.product?.cost ?? 0) ||
                            0;
                          const cost = unitCost * qty;

                          return { it, qty, unit, disc, gross, net, cost };
                        });

                        const grossTotal = rows.reduce(
                          (a, r) => a + r.gross,
                          0,
                        );
                        const discountTotal = rows.reduce(
                          (a, r) => a + r.disc,
                          0,
                        );
                        const netSale = Math.max(0, grossTotal - discountTotal);
                        const costTotal = rows.reduce((a, r) => a + r.cost, 0);

                        const commissionTotal = Math.max(0, grossTotal * rate); // tu regla (sobre bruto)

                        // prorrateo comisión por neto de línea
                        const netForWeights = rows.reduce(
                          (a, r) => a + r.net,
                          0,
                        );
                        const rowWithCommission = rows.map((r) => {
                          const w =
                            netForWeights > 0 ? r.net / netForWeights : 0;
                          const comm = commissionTotal * w;
                          return { ...r, comm };
                        });

                        const netCompany = Math.max(
                          0,
                          netSale - costTotal - commissionTotal,
                        );

                        return (
                          <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                              <Card className="shadow-none">
                                <CardContent className="p-4">
                                  <div className="text-xs text-muted-foreground">
                                    Total a facturar
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold">
                                    ${netSale.toLocaleString("es-AR")}
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="shadow-none">
                                <CardContent className="p-4">
                                  <div className="text-xs text-muted-foreground ">
                                    Costo
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold text-red-600">
                                    $
                                    {costTotal.toLocaleString("es-AR", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                  <div className="text-xs text-muted-foreground ">
                                    Comisión
                                  </div>
                                  <div className="mt-1 text-2xl font-semibold text-red-600">
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
                                    Margen Lambda
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

                            <table className="w-full text-sm">
                              <thead className="bg-muted/40">
                                <tr className="text-left">
                                  <th className="p-3 w-[360px]">Producto</th>
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
                                    Total
                                  </th>
                                  <th className="p-3 w-[140px] text-right whitespace-nowrap border-l border-muted-foreground/200">
                                    Costo
                                  </th>
                                  <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                    Comisión
                                  </th>
                                  <th className="p-3 w-[140px] text-right whitespace-nowrap">
                                    Margen
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="tabular-nums">
                                {/* Filas items */}
                                {rowWithCommission.map((r) => {
                                  const optionsDesc = describeItemOptions(
                                    r.it.options,
                                  );
                                  return (
                                    <tr key={r.it.id} className="border-t">
                                      <td className="p-3 truncate">
                                        {r.it.product?.name ?? "-"}
                                        {optionsDesc ? (
                                          <div className="text-xs text-muted-foreground">
                                            {optionsDesc}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="p-3 text-right">{r.qty}</td>
                                      <td className="p-3 text-right">
                                        ${r.unit.toLocaleString("es-AR")}
                                      </td>
                                      <td className="p-3 text-right">
                                        ${r.disc.toLocaleString("es-AR")}
                                      </td>
                                      <td className="p-3 text-right font-medium">
                                        ${r.net.toLocaleString("es-AR")}
                                      </td>
                                      <td className="p-3 text-right border-l border-muted-foreground/200">
                                        {editingCostItemId === r.it.id ? (
                                          <div className="flex items-center justify-end gap-1">
                                            <Input
                                              inputMode="decimal"
                                              value={costDraft}
                                              onChange={(e) =>
                                                setCostDraft(e.target.value)
                                              }
                                              className="h-7 w-24 text-right"
                                              autoFocus
                                            />
                                            <Button
                                              size="sm"
                                              className="h-7 px-2"
                                              disabled={costSaving}
                                              onClick={() => onSaveCost(r.it.id)}
                                            >
                                              OK
                                            </Button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="underline decoration-dotted underline-offset-2"
                                            onClick={() => openEditCost(r.it)}
                                            title="Editar costo real"
                                          >
                                            ${r.cost.toLocaleString("es-AR")}
                                          </button>
                                        )}
                                      </td>
                                      <td className="p-3 text-right">
                                        $
                                        {r.comm.toLocaleString("es-AR", {
                                          maximumFractionDigits: 2,
                                        })}
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* TOTAL BRUTO */}
                                <tr className="border-t bg-muted/10">
                                  <td className="p-3 font-medium">TOTAL</td>
                                  <td className="p-3" />
                                  <td className="p-3 text-right font-medium">
                                    ${grossTotal.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3 text-right font-medium text-red-600">
                                    -${discountTotal.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3 text-right font-bold text-green-600">
                                    ${netSale.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3" />
                                  <td className="p-3" />
                                </tr>

                                {/* - COSTO */}
                                {/* <tr className="border-t bg-muted/10">
                                  <td className="p-3 font-medium">- COSTO</td>
                                  <td className="p-3" />
                                  <td className="p-3" />
                                  <td className="p-3" />
                                  <td className="p-3" />
                                  <td className="p-3 text-right font-medium text-red-600">
                                    -${costTotal.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3" />
                                </tr> */}

                                {/* NETO EMPRESA */}
                                <tr className="border-t bg-muted/10">
                                  <td className="p-3 font-medium">
                                    NETO EMPRESA
                                  </td>
                                  <td className="p-3" />
                                  <td className="p-3" />
                                  <td className="p-3" />
                                  <td className="p-3 text-right font-medium">
                                    ${netSale.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3 text-right font-medium text-red-600">
                                    -${costTotal.toLocaleString("es-AR")}
                                  </td>
                                  <td className="p-3 text-right font-medium text-red-600">
                                    -$
                                    {commissionTotal.toLocaleString("es-AR", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="p-3 text-right font-bold text-green-600">
                                    ${netCompany.toLocaleString("es-AR")}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
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

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="!w-[88vw] !max-w-lg">
          <DialogHeader>
            <DialogTitle>Cerrar venta</DialogTitle>
          </DialogHeader>

          {closeErr ? (
            <Alert variant="destructive">
              <AlertDescription>{closeErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Modo de pago</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m === "MERCADO_PAGO"
                        ? "Mercado Pago"
                        : m[0] + m.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>N° factura / comprobante</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej: A-0001-00001234"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm text-muted-foreground">¿Pagado?</span>
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closeSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                setCloseErr(null);
                if (!closeSaleId) return;

                setCloseSaving(true);
                try {
                  const res = await updateSaleStatusAndAddItems({
                    saleId: closeSaleId,
                    status: "confirmed",
                    payment_method: paymentMethod,
                    invoice_number: invoiceNumber.trim() || null,
                    paid,
                    // no pasamos items acá: cerrar ≠ Agregar ítems
                  });

                  if (!res.ok) return setCloseErr(res.error);

                  setCloseOpen(false);
                  router.refresh();
                } finally {
                  setCloseSaving(false);
                }
              }}
              disabled={closeSaving || !closeSaleId}
            >
              {closeSaving ? "Cerrando..." : "Cerrar venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
