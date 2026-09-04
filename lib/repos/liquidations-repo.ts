"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LiquidationStatus = "draft" | "review" | "finalized" | "locked";

// ✅ agrego biweekly
export type LiquidationFrequency = "mensual" | "quincenal" | "quarterly" | "custom";

export type LiquidationRow = {
  id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  frequency: LiquidationFrequency;
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

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ymdToMonthlyRange(month: string) {
  // month: "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // último día del mes (UTC)
  return { period_start: toYMD(start), period_end: toYMD(end) };
}

function ymdToBiweeklyRange(month: string, half: 1 | 2) {
  // 1 => 01..15, 2 => 16..fin
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : lastDay;

  const start = new Date(Date.UTC(y, m - 1, startDay));
  const end = new Date(Date.UTC(y, m - 1, endDay));

  return { period_start: toYMD(start), period_end: toYMD(end) };
}

function periodToStartEndISO(period_start: string, period_end: string) {
  // usamos end EXCLUSIVO (día siguiente 00:00Z) para evitar líos de milisegundos
  const startISO = `${period_start}T00:00:00.000Z`;

  const endDate = new Date(`${period_end}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endExclusiveISO = endDate.toISOString();

  return { startISO, endExclusiveISO };
}

async function ensureNoDuplicateLiquidation(
  supabase: any,
  period_start: string,
  period_end: string,
  frequency: LiquidationFrequency,
) {
  const { data: existing, error } = await supabase
    .from("liquidations")
    .select("id")
    .eq("period_start", period_start)
    .eq("period_end", period_end)
    .eq("frequency", frequency)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, existingId: null as string | null };
  if (existing?.id) {
    return { ok: false as const, error: "Ya existe una liquidación para ese período.", existingId: String(existing.id) };
  }
  return { ok: true as const, error: null as string | null, existingId: null as string | null };
}

/**
 * ✅ NUEVO: Generar liquidación QUINCENAL
 * - half: 1 => 01-15, 2 => 16-fin
 */
export async function generateBiweeklyLiquidation(input: {
  month: string; // YYYY-MM
  half: 1 | 2;
}) {
  const supabase = await createClient();
  const { period_start, period_end } = ymdToBiweeklyRange(input.month, input.half);

  const dup = await ensureNoDuplicateLiquidation(supabase, period_start, period_end, "quincenal");
  if (!dup.ok) return { ok: false as const, error: dup.error };

  // 1) crear cabecera
  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .insert({
      period_start,
      period_end,
      frequency: "quincenal",
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

  const { startISO, endExclusiveISO } = periodToStartEndISO(period_start, period_end);

  // 2) traer ventas confirmadas del período (tomando valores YA guardados en sales)
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
    .gte("sold_at", startISO)
    .lt("sold_at", endExclusiveISO);

  if (salesErr) return { ok: false as const, error: salesErr.message };

  // 3) acumular por seller
  const acc = new Map<string, any>();

  for (const s of (sales ?? []) as any[]) {
    const sellerId = s.seller_id as string;
    if (!sellerId) continue;

    const gross = Number(s.total_gross) || 0;
    const discount = Number(s.total_discount) || 0;
    const net = Number(s.total_net) || 0;

    // si confirmada y aun así viniera null, caemos a 0 (pero ideal: que confirmed siempre tenga estos campos completos)
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

/**
 * (Tu función existente) Mensual
 * ✅ le agrego anti-duplicado
 * ✅ uso end EXCLUSIVO (lt) igual que quincena
 */
export async function generateMonthlyLiquidation(input: { month: string }) {
  const supabase = await createClient();
  const { period_start, period_end } = ymdToMonthlyRange(input.month);

  const dup = await ensureNoDuplicateLiquidation(supabase, period_start, period_end, "mensual");
  if (!dup.ok) return { ok: false as const, error: dup.error };

  // 1) crear cabecera
  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .insert({
      period_start,
      period_end,
      frequency: "mensual",
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
  const { startISO, endExclusiveISO } = periodToStartEndISO(period_start, period_end);

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
    .gte("sold_at", startISO)
    .lt("sold_at", endExclusiveISO);

  if (salesErr) return { ok: false as const, error: salesErr.message };

  const acc = new Map<string, any>();

  for (const s of (sales ?? []) as any[]) {
    const sellerId = s.seller_id as string;
    if (!sellerId) continue;

    const gross = Number(s.total_gross) || 0;
    const discount = Number(s.total_discount) || 0;
    const net = Number(s.total_net) || 0;

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

  const { error: delErr } = await supabase
    .from("liquidation_lines")
    .delete()
    .eq("liquidation_id", liquidationId);

  if (delErr) return { ok: false as const, error: delErr.message };

  const { startISO, endExclusiveISO } = periodToStartEndISO(period_start, period_end);

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
    .gte("sold_at", startISO)
    .lt("sold_at", endExclusiveISO);

  if (salesErr) return { ok: false as const, error: salesErr.message };

  const acc = new Map<string, any>();

  for (const s of (sales ?? []) as any[]) {
    const sellerId = s.seller_id as string;
    if (!sellerId) continue;

    const gross = Number(s.total_gross) || 0;
    const discount = Number(s.total_discount) || 0;
    const net = Number(s.total_net) || 0;

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


// Resumen agregado (todo el período, todos los vendedores) del costo
// "visualizador" de Biomodelo: cantidad de unidades vendidas y monto total
// a liquidar (cost_at_sale ya congelado por ítem al confirmar la venta).
export async function getLiquidationVisualizadorSummary(liquidationId: string) {
  const supabase = await createClient();

  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .select("id, period_start, period_end")
    .eq("id", liquidationId)
    .single();

  if (liqErr || !liq) {
    return {
      ok: false as const,
      error: liqErr?.message ?? "No se encontró la liquidación.",
      qty: 0,
      total: 0,
    };
  }

  const { startISO, endExclusiveISO } = periodToStartEndISO(
    liq.period_start,
    liq.period_end,
  );

  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id")
    .eq("status", "confirmed")
    .gte("sold_at", startISO)
    .lt("sold_at", endExclusiveISO);

  if (salesErr) {
    return { ok: false as const, error: salesErr.message, qty: 0, total: 0 };
  }

  const saleIds = (sales ?? []).map((s: any) => s.id);
  if (!saleIds.length) {
    return { ok: true as const, error: null, qty: 0, total: 0 };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("qty, cost_at_sale, options, sale:sales(usd_ars_rate)")
    .in("sale_id", saleIds)
    .not("options", "is", null);

  if (itemsErr) {
    return { ok: false as const, error: itemsErr.message, qty: 0, total: 0 };
  }

  let qty = 0;
  let total = 0;
  for (const it of (items ?? []) as any[]) {
    if (!it.options?.complexity) continue;
    const q = Number(it.qty) || 0;
    const cost = Number(it.cost_at_sale) || 0;
    // cost_at_sale queda en la moneda original del ítem; si la venta es en
    // dólares, se convierte a pesos con la cotización cargada al cerrarla
    // (misma lógica que computeAndFreezeOnConfirm en sales-repo.ts).
    const rate = Number(it.sale?.usd_ars_rate) || 0;
    const fx = rate > 0 ? rate : 1;
    qty += q;
    total += cost * q * fx;
  }

  return { ok: true as const, error: null, qty, total };
}

export async function getLiquidationSales(liquidationId: string) {
  const supabase = await createClient();

  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .select("id, period_start, period_end")
    .eq("id", liquidationId)
    .single();

  if (liqErr || !liq) {
    return {
      ok: false as const,
      error: liqErr?.message ?? "No se encontró la liquidación.",
      sales: [],
    };
  }

  const startISO = `${liq.period_start}T00:00:00.000Z`;

  const endDate = new Date(`${liq.period_end}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endExclusiveISO = endDate.toISOString();

  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select(`
      id,
      sold_at,
      seller_id,
      customer_name,
      total_net,
      total_commission,
      commission_rate_at_sale
    `)
    .eq("status", "confirmed")
    .gte("sold_at", startISO)
    .lt("sold_at", endExclusiveISO)
    .order("sold_at", { ascending: true });

  if (salesErr) {
    return {
      ok: false as const,
      error: salesErr.message,
      sales: [],
    };
  }

  return {
    ok: true as const,
    sales: sales ?? [],
  };
}