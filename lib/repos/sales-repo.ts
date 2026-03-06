// lib/repos/sales-repo.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/types";
export type SaleStatus = "pending" | "confirmed" | "cancelled" | "returned";

export type SaleInsert = {
  sold_at: string; // ISO string
  seller_id: string;
  customer_name?: string | null;
  channel?: string | null;
  status: SaleStatus;
  notes?: string | null;
  commission_plan_id: string;
};

export type SaleItemInsert = {
  product_id: string;
  qty: number;
  unit_price: number;
  discount: number; // MONTO descuento (no %)
};

function toNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function computeAndFreezeOnConfirm(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  saleId: string;
}) {
  const { supabase, saleId } = args;

  // 1) Traer venta (para commission_plan_id y totales net/gross si ya existen)
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, commission_plan_id, total_gross, total_discount, total_net, status")
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) {
    return { ok: false as const, error: saleErr?.message ?? "No se pudo leer la venta." };
  }

  // 2) Traer items (incluye cost_at_sale para no pisar si ya estaba congelado)
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("id, product_id, qty, unit_price, discount, cost_at_sale")
    .eq("sale_id", saleId);

  if (itemsErr) {
    return { ok: false as const, error: itemsErr.message };
  }

  const allItems = items ?? [];
  if (!allItems.length) {
    return { ok: false as const, error: "La venta no tiene ítems." };
  }

  // 3) Traer costos actuales de products
  const productIds = [...new Set(allItems.map((it: any) => it.product_id))];

  const { data: prods, error: prodErr } = await supabase
    .from("products")
    .select("id, cost")
    .in("id", productIds);

  if (prodErr) {
    return { ok: false as const, error: prodErr.message };
  }

  const costById = new Map<string, number>(
    (prods ?? []).map((p: any) => [p.id, toNum(p.cost)])
  );

  // 4) Congelar cost_at_sale SOLO si está null
  const toUpdate = allItems
    .filter((it: any) => it.cost_at_sale == null)
    .map((it: any) => ({
      id: it.id,
      cost_at_sale: costById.get(it.product_id) ?? 0,
    }));

  if (toUpdate.length) {
    // Batch update (Promise.all)
    const results = await Promise.all(
      toUpdate.map((u) =>
        supabase.from("sale_items").update({ cost_at_sale: u.cost_at_sale }).eq("id", u.id)
      )
    );
    const bad = results.find((r) => r.error);
    if (bad?.error) return { ok: false as const, error: bad.error.message };
  }

  // 5) Recalcular totales usando COSTO CONGELADO (cost_at_sale si existe; si no, el actual)
  const rows = allItems.map((it: any) => {
    const qty = toNum(it.qty);
    const unit = toNum(it.unit_price);
    const disc = toNum(it.discount);
    const gross = qty * unit;
    const net = Math.max(0, gross - disc);

    const unitCost =
      it.cost_at_sale != null ? toNum(it.cost_at_sale) : (costById.get(it.product_id) ?? 0);

    const cost = unitCost * qty;

    return { qty, unit, disc, gross, net, cost };
  });

  const grossTotal = rows.reduce((a, r) => a + r.gross, 0);
  const discountTotal = rows.reduce((a, r) => a + r.disc, 0);
  const netTotal = Math.max(0, grossTotal - discountTotal);
  const costTotal = rows.reduce((a, r) => a + r.cost, 0);

  // 6) Traer plan y congelar snapshot
  const { data: plan, error: planErr } = await supabase
    .from("commission_plans")
    .select("base_calc, default_rate")
    .eq("id", sale.commission_plan_id)
    .single();

  if (planErr || !plan) {
    return { ok: false as const, error: planErr?.message ?? "No se pudo leer el plan de comisión." };
  }

  const commissionRate = toNum(plan.default_rate);
  const commissionBaseCalc: "sale" | "margin" =
    plan.base_calc === "margin" ? "margin" : "sale";

  const margin = Math.max(0, netTotal - costTotal);
  const commissionBase = commissionBaseCalc === "margin" ? margin : grossTotal;

  const totalCommission = Math.max(0, commissionBase * commissionRate);
  const companyProfit = Math.max(0, netTotal - costTotal - totalCommission);

  // 7) Guardar snapshots finales en sales
  const { error: upSaleErr } = await supabase
    .from("sales")
    .update({
      total_gross: grossTotal,
      total_discount: discountTotal,
      total_net: netTotal,
      total_cost: costTotal,
      total_commission: totalCommission,
      company_profit: companyProfit,
      commission_rate_at_sale: commissionRate,
      commission_base_calc_at_sale: commissionBaseCalc,
    })
    .eq("id", saleId);

  if (upSaleErr) return { ok: false as const, error: upSaleErr.message };

  return { ok: true as const };
}

export async function createSaleWithItems(input: {
  sale: SaleInsert;
  items: SaleItemInsert[];
}) {
  const supabase = await createClient();

  if (!input.items.length) {
    return { ok: false as const, error: "La venta debe tener al menos 1 ítem." };
  }

  // Totales base (bruto/desc/net) siempre se guardan
  const gross = input.items.reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0
  );
  const discount = input.items.reduce((a, it) => a + toNum(it.discount), 0);
  const net = Math.max(0, gross - discount);

  // 1) Insert sale (cabecera)
  const { data: saleRow, error: saleErr } = await supabase
    .from("sales")
    .insert({
      sold_at: input.sale.sold_at,
      seller_id: input.sale.seller_id,
      customer_name: input.sale.customer_name ?? null,
      channel: input.sale.channel ?? null,
      status: input.sale.status,
      notes: input.sale.notes ?? null,
      commission_plan_id: input.sale.commission_plan_id,
      total_gross: gross,
      total_discount: discount,
      total_net: net,
    })
    .select("id")
    .single();

  if (saleErr || !saleRow?.id) {
    return {
      ok: false as const,
      error: saleErr?.message ?? "Error creando venta.",
    };
  }

  const saleId = saleRow.id as string;

  // 2) Insert items
  const itemsPayload = input.items.map((it) => ({
    sale_id: saleId,
    product_id: it.product_id,
    qty: toNum(it.qty),
    unit_price: toNum(it.unit_price),
    discount: toNum(it.discount) || 0,
    // cost_at_sale se congela al confirmar (lo hacemos abajo para también guardar totales correctos)
  }));

  const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload);

  if (itemsErr) {
    await supabase.from("sales").delete().eq("id", saleId);
    return { ok: false as const, error: itemsErr.message };
  }

  // 3) Si se creó CONFIRMED -> congelar snapshots ahora
  if (input.sale.status === "confirmed") {
    const snap = await computeAndFreezeOnConfirm({ supabase, saleId });
    if (!snap.ok) {
      // Si querés ser estricto, podrías rollback, pero no lo hago para no perder la venta;
      // devolvemos error para que lo veas y lo reintentes.
      return { ok: false as const, error: snap.error };
    }
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const, saleId };
}

export async function getSales() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("sold_at", { ascending: false });

  if (error) {
    console.error("getSales error:", error);
    return [];
  }
  return data ?? [];
}

export async function getSaleDetail(saleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_items")
    .select("id, qty, unit_price, discount, cost_at_sale, product:products(name, cost)")
    .eq("sale_id", saleId)
    .order("id", { ascending: true });

  if (error)
    return { ok: false as const, error: error.message, items: [] as any[] };
  return { ok: true as const, items: data ?? [] };
}

/**
 * Editar venta:
 * - Actualiza estado
 * - Agrega ítems nuevos (opcional)
 * - Recalcula total_gross/total_discount/total_net
 * - Si status => confirmed: congela cost_at_sale + guarda snapshots (cost/commission/profit)
 */
export async function updateSaleStatusAndAddItems(input: {
  saleId: string;
  status: SaleStatus;
  items?: SaleItemInsert[];
    payment_method?: PaymentMethod;
  invoice_number?: string | null;
  paid?: boolean;
}) {
  const supabase = await createClient();

  // 1) Traer items existentes para recomputar base
  const { data: existing, error: exErr } = await supabase
    .from("sale_items")
    .select("qty, unit_price, discount")
    .eq("sale_id", input.saleId);

  if (exErr) return { ok: false as const, error: exErr.message };

  const baseGross = (existing ?? []).reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0
  );
  const baseDiscount = (existing ?? []).reduce((a, it) => a + toNum(it.discount), 0);

  const newItems = (input.items ?? []).filter(
    (it) => it.product_id && toNum(it.qty) > 0
  );

  // 2) Insertar items nuevos (opcional)
  if (newItems.length) {
    const payload = newItems.map((it) => ({
      sale_id: input.saleId,
      product_id: it.product_id,
      qty: toNum(it.qty),
      unit_price: toNum(it.unit_price),
      discount: toNum(it.discount) || 0,
      // cost_at_sale se congela si confirmás (abajo)
    }));

    const { error: insErr } = await supabase.from("sale_items").insert(payload);
    if (insErr) return { ok: false as const, error: insErr.message };
  }

  // 3) Recalcular totales (existentes + nuevos)
  const addGross = newItems.reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0
  );
  const addDiscount = newItems.reduce((a, it) => a + (toNum(it.discount) || 0), 0);

  const gross = baseGross + addGross;
  const discount = baseDiscount + addDiscount;
  const net = Math.max(0, gross - discount);

  // 4) Update venta (estado + totales base)
  const { error: upErr } = await supabase
    .from("sales")
    .update({
      status: input.status,
      total_gross: gross,
      total_discount: discount,
      total_net: net,
      payment_method: input.payment_method ?? undefined,
invoice_number: input.invoice_number ?? undefined,
paid_at: input.paid ? new Date().toISOString() : undefined,
    })
    .eq("id", input.saleId);

  if (upErr) return { ok: false as const, error: upErr.message };

  // 5) Si quedó CONFIRMED: congelar y guardar snapshots finales
  if (input.status === "confirmed") {
    const snap = await computeAndFreezeOnConfirm({ supabase, saleId: input.saleId });
    if (!snap.ok) return snap;
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}