"use client";

import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Plus, Eye, Lock, CheckCircle, FileText } from "lucide-react";
import { formatDateTimeAR, formatDateAR } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  LiquidationRow,
  LiquidationLineRow,
  LiquidationStatus,
} from "@/lib/repos/liquidations-repo";
import {
  generateMonthlyLiquidation,
  generateBiweeklyLiquidation,
  getLiquidationDetail,
  getLiquidationSales,
  getLiquidationVisualizadorSummary,
  setLiquidationStatus,
  recalculateLiquidation,
} from "@/lib/repos/liquidations-repo";

type SellerLite = {
  id: string;
  name?: string | null;
  display_name?: string | null;
  sales_team?: string | null;
};
const statusLabels: Record<LiquidationStatus, string> = {
  draft: "Borrador",
  review: "Revisión",
  finalized: "Finalizada",
  locked: "Bloqueada",
};

const statusColors: Record<LiquidationStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  review: "bg-blue-100 text-blue-800",
  finalized: "bg-emerald-100 text-emerald-800",
  locked: "bg-gray-100 text-gray-800",
};

function fmtMoney(n: number) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function formatPeriod(start?: string | null, end?: string | null) {
  if (!start || !end) return "-";
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return `${s.toLocaleDateString("es-AR")} al ${e.toLocaleDateString("es-AR")}`;
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

function monthOptions() {
  // últimos 12 meses incluyendo el actual
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const value = `${y}-${m}`; // YYYY-MM
    const label = d.toLocaleString("es-AR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

export default function LiquidationsContent({
  liquidationsIniciales,
  sellers,
}: {
  liquidationsIniciales: LiquidationRow[];
  sellers: SellerLite[];
}) {
  const [selectedLiqId, setSelectedLiqId] = useState<string | null>(null);
  const [selectedLiq, setSelectedLiq] = useState<LiquidationRow | null>(null);
  const [lines, setLines] = useState<LiquidationLineRow[]>([]);
  const [visualizador, setVisualizador] = useState<{ qty: number; total: number }>({
    qty: 0,
    total: 0,
  });
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(monthOptions()[0]?.value ?? "");
  const [genType, setGenType] = useState<"mensual" | "quincenal">("mensual"); // ✅
  const [genHalf, setGenHalf] = useState<1 | 2>(1); // ✅ 1=01-15, 2=16-fin

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sellerById = useMemo(
    () => new Map(sellers.map((s) => [s.id, s])),
    [sellers],
  );

  const kpis = useMemo(() => {
    const totalNet = lines.reduce((a, l) => a + Number(l.net_total || 0), 0);
    const totalCommission = lines.reduce(
      (a, l) => a + Number(l.commission_total || 0),
      0,
    );
    const totalProfit = lines.reduce(
      (a, l) => a + Number(l.company_profit || 0),
      0,
    );
    const totalDiscount = lines.reduce(
      (a, l) => a + Number(l.discount_total || 0),
      0,
    );
    return { totalNet, totalCommission, totalProfit, totalDiscount };
  }, [lines]);

async function handleGenerateSellerPdfs(liq: LiquidationRow) {
  try {
    const salesRes = await getLiquidationSales(liq.id);
    if (!salesRes.ok) {
      console.error(salesRes.error);
      return;
    }

    const allSales = salesRes.sales ?? [];
    if (!allSales.length) {
      console.warn("No hay ventas para esta liquidación.");
      return;
    }

    const periodText = formatPeriod(liq.period_start, liq.period_end);

    const salesBySeller = new Map<string, any[]>();
    for (const sale of allSales) {
      if (!salesBySeller.has(sale.seller_id)) {
        salesBySeller.set(sale.seller_id, []);
      }
      salesBySeller.get(sale.seller_id)!.push(sale);
    }

    for (const [sellerId, sellerSales] of salesBySeller.entries()) {
      const seller = sellerById.get(sellerId);
      const sellerName =
        (seller?.name ?? seller?.display_name ?? "Vendedor") +
        (seller?.sales_team ? ` (${seller.sales_team})` : "");

      const rows = sellerSales.map((sale) => ({
        date: formatDateAR(sale.sold_at),
        customer: sale.customer_name ?? "-",
        totalSale: Number(sale.total_net || 0),
        commissionPct: Math.round(
          Number(sale.commission_rate_at_sale || 0) * 100,
        ),
        commissionTotal: Number(sale.total_commission || 0),
      }));

      const totalVendido = rows.reduce((acc, r) => acc + r.totalSale, 0);
      const totalComision = rows.reduce((acc, r) => acc + r.commissionTotal, 0);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      try {
        const logoDataUrl = await loadImageAsDataUrl("/logo-text.png");
        doc.addImage(logoDataUrl, "PNG", 14, 17, 80, 28);
      } catch (e) {
        console.warn("No se pudo cargar el logo de liquidación.", e);
      }

      const rightX = 120;
      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LIQUIDACIÓN", rightX, y);

      // y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // doc.text(`ID Liquidación: ${liq.id}`, rightX, y);

      y += 10;
      doc.text(`Fecha de emisión: ${formatDateAR(new Date())}`, rightX, y);

      y += 7;
      doc.text(`Período: ${periodText}`, rightX, y);

      y += 7;
      doc.text(`Vendedor: ${sellerName}`, rightX, y);

      y += 7;
      doc.text(`Estado: ${statusLabels[liq.status]}`, rightX, y);

      const headerBottomY = Math.max(42, y + 6);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, headerBottomY, pageWidth - 14, headerBottomY);

      const tableStartY = headerBottomY + 8;

      autoTable(doc, {
        startY: tableStartY,
        head: [[
          "Fecha",
          "Cliente",
          "Total venta",
          "% comisión",
          "Comisión",
        ]],
        body: rows.map((r) => [
          r.date,
          r.customer,
          fmtMoney(r.totalSale),
          `${r.commissionPct}%`,
          fmtMoney(r.commissionTotal),
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
  0: { cellWidth: 24, halign: "left" },   // Fecha
  1: { cellWidth: 72, halign: "left" },   // Cliente
  2: { cellWidth: 30, halign: "right" },  // Total venta
  3: { cellWidth: 26, halign: "right" },  // % comisión
  4: { cellWidth: 40, halign: "right" },  // Comisión
},
        didParseCell(data) {
          if (data.section === "head") {
            if (data.column.index <= 1) {
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
      doc.text(`TOTAL VENDIDO: ${fmtMoney(totalVendido)}`, 14, finalY + 14);
      doc.text(`TOTAL A LIQUIDAR: ${fmtMoney(totalComision)}`, 14, finalY + 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "Documento interno de liquidación de comisiones.",
        14,
        finalY + 34,
      );

      const safeSellerName = sellerName
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "_");

      doc.save(
        `liquidacion-${safeSellerName}-${liq.period_start}-${liq.period_end}.pdf`,
      );
    }
  } catch (error) {
    console.error("Error generando PDFs por vendedor:", error);
  }
}
  async function openDetail(liqId: string) {
    setErr(null);
    setDetailErr(null);
    setSelectedLiqId(liqId);
    setLoadingDetail(true);
    try {
      const res = await getLiquidationDetail(liqId);
      if (!res.ok) {
        setDetailErr(res.error);
        return;
      }
      setSelectedLiq(res.liquidation);
      setLines(res.lines);

      const visRes = await getLiquidationVisualizadorSummary(liqId);
      setVisualizador(
        visRes.ok ? { qty: visRes.qty, total: visRes.total } : { qty: 0, total: 0 },
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function onGenerate() {
    setErr(null);
    if (!genMonth) return setErr("Seleccioná un mes.");

    setSaving(true);
    try {
      const res =
        genType === "mensual"
          ? await generateMonthlyLiquidation({ month: genMonth })
          : await generateBiweeklyLiquidation({
              month: genMonth,
              half: genHalf,
            });

      if (!res.ok) return setErr(res.error);

      setGenerateOpen(false);
      await openDetail(res.liquidationId);
    } finally {
      setSaving(false);
    }
  }

  async function onRecalculate() {
    if (!selectedLiqId) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await recalculateLiquidation(selectedLiqId);
      if (!res.ok) return setErr(res.error);
      await openDetail(selectedLiqId);
    } finally {
      setSaving(false);
    }
  }

  async function moveStatus(next: LiquidationStatus) {
    if (!selectedLiqId) return;
    setSaving(true);
    try {
      const res = await setLiquidationStatus(selectedLiqId, next);
      if (!res.ok) setErr(res.error);
      // refrescar detalle
      await openDetail(selectedLiqId);
    } finally {
      setSaving(false);
    }
  }

  // DETALLE
  if (selectedLiqId) {
    return (
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="mb-1 -ml-3 text-muted-foreground"
                onClick={() => {
                  setSelectedLiqId(null);
                  setSelectedLiq(null);
                  setLines([]);
                  setVisualizador({ qty: 0, total: 0 });
                }}
              >
                {"<-"} Volver
              </Button>

              <h2 className="text-xl font-bold text-card-foreground">
                {selectedLiq
                  ? `${selectedLiq.period_start} → ${selectedLiq.period_end}`
                  : "Liquidación"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Frecuencia: {selectedLiq?.frequency} · Solo ventas confirmadas
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedLiq ? (
                <Badge
                  variant="secondary"
                  className={`${statusColors[selectedLiq.status]}`}
                >
                  {statusLabels[selectedLiq.status]}
                </Badge>
              ) : null}

              {selectedLiq?.status === "draft" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => moveStatus("finalized")}
                  disabled={saving}
                >
                  <CheckCircle className="h-4 w-4" />
                  Finalizar
                </Button>
              ) : null}

              {selectedLiq?.status === "finalized" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => moveStatus("locked")}
                  disabled={saving}
                >
                  <Lock className="h-4 w-4" />
                  Bloquear
                </Button>
              ) : null}

              {selectedLiq?.status !== "locked" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={onRecalculate}
                  disabled={saving}
                >
                  Recalcular
                </Button>
              ) : null}
            </div>
          </div>

          {detailErr ? (
            <Alert variant="destructive">
              <AlertDescription>{detailErr}</AlertDescription>
            </Alert>
          ) : null}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{fmtMoney(kpis.totalNet)}</p>
                <p className="text-xs text-muted-foreground">Total Neto</p>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center ">
                <p className="text-2xl font-bold text-red-600">
                  {fmtMoney(kpis.totalCommission)}
                </p>
                <p className="text-xs text-muted-foreground">Comisiones</p>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {fmtMoney(kpis.totalDiscount)}
                </p>
                <p className="text-xs text-muted-foreground">Descuentos</p>
              </CardContent>
            </Card>

            <Card className="border border-border ">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {fmtMoney(kpis.totalProfit)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ganancia Empresa
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="audit">Auditoría</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="p-3 text-left">
                          Vendedor
                        </TableHead>
                        <TableHead className="p-3 text-left">Bruto</TableHead>
                        <TableHead className="p-3 text-left">
                          Descuento
                        </TableHead>
                        <TableHead className="p-3 text-left">Neto</TableHead>
                        <TableHead className="p-3 text-left">
                          Comisión
                        </TableHead>
                        <TableHead className="p-3 text-left ">
                          Ganancia Empresa
                        </TableHead>
                        <TableHead className="pr-4 text-sm">Liquidar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => {
                        const s = sellerById.get(l.seller_id);
                        const sellerName =
                          (s?.name ?? s?.display_name ?? "Vendedor") +
                          (s?.sales_team ? ` (${s.sales_team})` : "");
                        const payout = Number(l.commission_total || 0);
                        return (
                          <TableRow key={l.id} className="h-12">
                            <TableCell className="pl-4 text-sm font-medium">
                              {sellerName}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fmtMoney(Number(l.gross_total))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fmtMoney(Number(l.discount_total))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fmtMoney(Number(l.net_total))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fmtMoney(Number(l.commission_total))}
                            </TableCell>
                            <TableCell className="p-3 ">
                              {fmtMoney(Number(l.company_profit))}
                            </TableCell>
                            <TableCell className="text-red-600 pr-4 text-sm font-semibold">
                              {fmtMoney(payout)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!loadingDetail && lines.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="p-6 text-center text-muted-foreground"
                          >
                            No hay ventas confirmadas en este período.
                          </TableCell>
                        </TableRow>
                      ) : null}

                      {visualizador.qty > 0 ? (
                        <TableRow className="h-12 border-t-2 bg-muted/30">
                          <TableCell className="pl-4 text-sm font-medium">
                            Visualizador (Biomodelo)
                          </TableCell>
                          <TableCell
                            colSpan={5}
                            className="text-sm text-muted-foreground"
                          >
                            Cantidad: {visualizador.qty}
                          </TableCell>
                          <TableCell className="text-red-600 pr-4 text-sm font-semibold">
                            {fmtMoney(visualizador.total)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="mt-4">
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  MVP: el detalle por venta lo agregamos después (si querés, lo
                  hacemos como en “Ver venta”).
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  MVP: audit trail pendiente.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    );
  }

  // LISTA
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle>Registro</CardTitle>
            <p className="text-xs text-muted-foreground">
              Mensuales por calendario
            </p>
          </div>

          <Button
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setGenType("mensual");
              setGenHalf(1);
              setGenerateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Generar liquidación
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          {/* TABLA (mismo look que Productos) */}
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              <Table className="w-full text-sm">
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-3 text-left">ID</TableHead>
                    <TableHead className="p-3 text-left">Período</TableHead>
                    <TableHead className="p-3 text-left">Frecuencia</TableHead>
                    <TableHead className="p-3 text-left">Estado</TableHead>
                    <TableHead className="p-3 text-left">Creado</TableHead>
                    <TableHead className="p-3 text-left">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {liquidationsIniciales.map((liq) => (
                    <TableRow key={liq.id} className="border-t">
                      <TableCell className="pl-4 p-3 text-sm font-medium whitespace-nowrap">
                        {liq.id}
                      </TableCell>

                      <TableCell className="p-3 text-sm whitespace-nowrap">
                        {liq.period_start} → {liq.period_end}
                      </TableCell>

                      <TableCell className="p-3 text-sm capitalize">
                        {liq.frequency}
                      </TableCell>

                      <TableCell className="p-3">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${statusColors[liq.status]}`}
                        >
                          {statusLabels[liq.status]}
                        </Badge>
                      </TableCell>

                      <TableCell className="p-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTimeAR(liq.created_at)}
                      </TableCell>

                      <TableCell className="pr-4 p-3 text-left">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1"
                          onClick={() => openDetail(liq.id)}
                        >
                          <Eye className="h-8 w-8" />
                        </Button>
             <Button
  type="button"
  variant="outline"
 onClick={() => handleGenerateSellerPdfs(liq)}
>
  <FileText className="mr-2 h-4 w-4" />
  PDF liquidación
</Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {liquidationsIniciales.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        No hay liquidaciones aún.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar liquidación</DialogTitle>
            <DialogDescription>
              Se calculará usando ventas confirmadas del período.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={genType}
                onValueChange={(v) => setGenType(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mes</label>
              <Select value={genMonth} onValueChange={setGenMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions().map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quincena (solo si es quincenal) */}
            {genType === "quincenal" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Quincena</label>
                <Select
                  value={String(genHalf)}
                  onValueChange={(v) => setGenHalf((Number(v) as 1 | 2) ?? 1)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 al 15</SelectItem>
                    <SelectItem value="2">16 al fin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={onGenerate} disabled={saving}>
              {saving ? "Generando..." : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
