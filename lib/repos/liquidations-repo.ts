"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LiquidationStatus = "draft" | "review" | "finalized" | "locked";

export type LiquidationRow = {
  id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  frequency: "monthly" | "quarterly" | "custom";
  status: LiquidationStatus;
  created_at: string;
};

export type LiquidationLineRow = {
  id: string;
  liquidation_id: string;
  seller_id: string;
  gross_total: number;
  discount_total: number;
  net_total: number;
  cost_total: number;
  commission_total: number;
  company_profit: number;
  created_at: string;
};

export async function getLiquidations(): Promise<LiquidationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liquidations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLiquidations error:", error);
    return [];
  }
  return (data ?? []) as LiquidationRow[];
}

export async function getLiquidationDetail(liquidationId: string) {
  const supabase = await createClient();

  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .select("*")
    .eq("id", liquidationId)
    .single();

  if (liqErr || !liq) {
    return {
      ok: false as const,
      error: liqErr?.message ?? "No existe",
      liquidation: null,
      lines: [] as LiquidationLineRow[],
    };
  }

  const { data: lines, error: linesErr } = await supabase
    .from("liquidation_lines")
    .select("*")
    .eq("liquidation_id", liquidationId);

  if (linesErr) {
    return {
      ok: false as const,
      error: linesErr.message,
      liquidation: liq,
      lines: [] as LiquidationLineRow[],
    };
  }

  return {
    ok: true as const,
    liquidation: liq as LiquidationRow,
    lines: (lines ?? []) as LiquidationLineRow[],
  };
}

export async function setLiquidationStatus(
  liquidationId: string,
  status: LiquidationStatus,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("liquidations")
    .update({ status })
    .eq("id", liquidationId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/liquidations");
  return { ok: true as const };
}

function ymdToDateRange(month: string) {
  // month: "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // último día del mes
  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  return { period_start: toYMD(start), period_end: toYMD(end) };
}

export async function generateMonthlyLiquidation(input: { month: string }) {
  const supabase = await createClient();
  const { period_start, period_end } = ymdToDateRange(input.month);

  // 1) crear cabecera
  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .insert({
      period_start,
      period_end,
      frequency: "monthly",
      status: "draft",
    })
    .select("id")
    .single();

  if (liqErr || !liq?.id) {
    return {
      ok: false as const,
      error: liqErr?.message ?? "Error creando liquidación",
    };
  }

  const liquidationId = liq.id as string;

  // 2) traer ventas confirmadas del período con items+product cost y plan rate
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select(
      `
    id,
    seller_id,
    sold_at,
    status,
    total_gross,
    total_discount,
    total_net,
    total_cost,
    total_commission,
    company_profit
  `,
    )
    .eq("status", "confirmed")
    .gte("sold_at", `${period_start}T00:00:00.000Z`)
    .lte("sold_at", `${period_end}T23:59:59.999Z`);

  if (salesErr) return { ok: false as const, error: salesErr.message };

  // 3) acumular por seller
const acc = new Map<string, any>();

for (const s of (sales ?? []) as any[]) {
  const sellerId = s.seller_id as string;
  if (!sellerId) continue;

  const gross = Number(s.total_gross) || 0;
  const discount = Number(s.total_discount) || 0;
  const net = Number(s.total_net) || 0;

  // IMPORTANTÍSIMO: si no está cerrado, estos pueden venir null
  const cost = Number(s.total_cost) || 0;
  const commission = Number(s.total_commission) || 0;
  const profit = Number(s.company_profit) || (net - cost - commission);

  const prev = acc.get(sellerId);
  if (!prev) {
    acc.set(sellerId, {
      seller_id: sellerId,
      gross_total: gross,
      discount_total: discount,
      net_total: net,
      cost_total: cost,
      commission_total: commission,
      company_profit: profit,
    });
  } else {
    prev.gross_total += gross;
    prev.discount_total += discount;
    prev.net_total += net;
    prev.cost_total += cost;
    prev.commission_total += commission;
    prev.company_profit += profit;
  }
}

  const linesPayload = Array.from(acc.values()).map((l: any) => ({
    liquidation_id: liquidationId,
    seller_id: l.seller_id,
    gross_total: l.gross_total,
    discount_total: l.discount_total,
    net_total: l.net_total,
    cost_total: l.cost_total,
    commission_total: l.commission_total,
    company_profit: l.company_profit,
  }));

  if (linesPayload.length) {
    const { error: linesErr } = await supabase
      .from("liquidation_lines")
      .insert(linesPayload);
    if (linesErr) return { ok: false as const, error: linesErr.message };
  }

  revalidatePath("/liquidations");
  return { ok: true as const, liquidationId };
}

export async function recalculateLiquidation(liquidationId: string) {
  const supabase = await createClient();

  // 1) Traer cabecera (periodo)
  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .select("id, period_start, period_end, status, frequency")
    .eq("id", liquidationId)
    .single();

  if (liqErr || !liq)
    return {
      ok: false as const,
      error: liqErr?.message ?? "No existe liquidación",
    };

  if (liq.status === "locked") {
    return {
      ok: false as const,
      error: "La liquidación está bloqueada. No se puede recalcular.",
    };
  }

  const period_start = liq.period_start as string;
  const period_end = liq.period_end as string;

  // 2) Borrar líneas actuales
  const { error: delErr } = await supabase
    .from("liquidation_lines")
    .delete()
    .eq("liquidation_id", liquidationId);

  if (delErr) return { ok: false as const, error: delErr.message };

  // 3) Traer ventas confirmadas del período
const { data: sales, error: salesErr } = await supabase
  .from("sales")
  .select(`
    id,
    seller_id,
    sold_at,
    status,
    total_gross,
    total_discount,
    total_net,
    total_cost,
    total_commission,
    company_profit
  `)
  .eq("status", "confirmed")
  .gte("sold_at", `${period_start}T00:00:00.000Z`)
  .lte("sold_at", `${period_end}T23:59:59.999Z`);

  if (salesErr) return { ok: false as const, error: salesErr.message };

  // 4) Recalcular acumulados por seller
const acc = new Map<string, any>();

for (const s of (sales ?? []) as any[]) {
  const sellerId = s.seller_id as string;
  if (!sellerId) continue;

  const gross = Number(s.total_gross) || 0;
  const discount = Number(s.total_discount) || 0;
  const net = Number(s.total_net) || 0;

  // IMPORTANTÍSIMO: si no está cerrado, estos pueden venir null
  const cost = Number(s.total_cost) || 0;
  const commission = Number(s.total_commission) || 0;
  const profit = Number(s.company_profit) || (net - cost - commission);

  const prev = acc.get(sellerId);
  if (!prev) {
    acc.set(sellerId, {
      seller_id: sellerId,
      gross_total: gross,
      discount_total: discount,
      net_total: net,
      cost_total: cost,
      commission_total: commission,
      company_profit: profit,
    });
  } else {
    prev.gross_total += gross;
    prev.discount_total += discount;
    prev.net_total += net;
    prev.cost_total += cost;
    prev.commission_total += commission;
    prev.company_profit += profit;
  }
}

  const payload = Array.from(acc.values()).map((l: any) => ({
    liquidation_id: liquidationId,
    seller_id: l.seller_id,
    gross_total: l.gross_total,
    discount_total: l.discount_total,
    net_total: l.net_total,
    cost_total: l.cost_total,
    commission_total: l.commission_total,
    company_profit: l.company_profit,
  }));

  if (payload.length) {
    const { error: insErr } = await supabase
      .from("liquidation_lines")
      .insert(payload);
    if (insErr) return { ok: false as const, error: insErr.message };
  }

  revalidatePath("/liquidations");
  return { ok: true as const };
}
