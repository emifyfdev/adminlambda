"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod, SaleItemOptions } from "@/lib/types";
import {
  BIOMODELO_VISUALIZADOR_RATE,
  getBiomodeloBaseUnitPrice,
} from "@/lib/types";

export type SaleStatus = "pending" | "confirmed" | "cancelled" | "returned";

export type SaleInsert = {
  sold_at: string;
  seller_id: string;
  customer_name?: string | null;
  channel?: string | null;
  status: SaleStatus;
  notes?: string | null;
  commission_plan_id: string;
  order_discount?: number | null;
};

export type SaleItemInsert = {
  product_id: string;
  qty: number;
  unit_price: number;
  discount: number; // monto descuento
  options?: SaleItemOptions;
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

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select(
      "id, commission_plan_id, total_gross, total_discount, total_net, status, order_discount",
    )
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) {
    return {
      ok: false as const,
      error: saleErr?.message ?? "No se pudo leer la venta.",
    };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("id, product_id, qty, unit_price, discount, cost_at_sale, options")
    .eq("sale_id", saleId);

  if (itemsErr) {
    return { ok: false as const, error: itemsErr.message };
  }

  const allItems = items ?? [];
  if (!allItems.length) {
    return { ok: false as const, error: "La venta no tiene ítems." };
  }

  const productIds = [...new Set(allItems.map((it: any) => it.product_id))];

  const { data: prods, error: prodErr } = await supabase
    .from("products")
    .select("id, cost")
    .in("id", productIds);

  if (prodErr) {
    return { ok: false as const, error: prodErr.message };
  }

  const costById = new Map<string, number>(
    (prods ?? []).map((p: any) => [p.id, toNum(p.cost)]),
  );

  // Costo por unidad de cada ítem: para Biomodelo (tiene options.complexity)
  // es automático (visualizador = 15% del precio BASE, sin adicionales);
  // para el resto, el costo cargado en el producto.
  function unitCostFor(it: any): number {
    if (it.options?.complexity) {
      return (
        getBiomodeloBaseUnitPrice(toNum(it.unit_price), it.options) *
        BIOMODELO_VISUALIZADOR_RATE
      );
    }
    return costById.get(it.product_id) ?? 0;
  }

  const toUpdate = allItems
    .filter((it: any) => it.cost_at_sale == null)
    .map((it: any) => ({
      id: it.id,
      cost_at_sale: unitCostFor(it),
    }));

  if (toUpdate.length) {
    const results = await Promise.all(
      toUpdate.map((u) =>
        supabase
          .from("sale_items")
          .update({ cost_at_sale: u.cost_at_sale })
          .eq("id", u.id),
      ),
    );

    const bad = results.find((r) => r.error);
    if (bad?.error) {
      return { ok: false as const, error: bad.error.message };
    }
  }

  const rows = allItems.map((it: any) => {
    const qty = toNum(it.qty);
    const unit = toNum(it.unit_price);
    const disc = toNum(it.discount);
    const gross = qty * unit;
    const net = Math.max(0, gross - disc);

    const unitCost =
      it.cost_at_sale != null ? toNum(it.cost_at_sale) : unitCostFor(it);

    const cost = unitCost * qty;

    // Base de comisión: para Biomodelo, solo el precio BASE (sin
    // adicionales); para el resto, el bruto del ítem (como siempre).
    const commissionBasis = it.options?.complexity
      ? getBiomodeloBaseUnitPrice(unit, it.options) * qty
      : gross;

    return { qty, unit, disc, gross, net, cost, commissionBasis };
  });

  const grossTotal = rows.reduce((a, r) => a + r.gross, 0);
  const discountTotal = rows.reduce((a, r) => a + r.disc, 0);
  const orderDiscount = toNum(sale.order_discount);
  const netTotal = Math.max(0, grossTotal - discountTotal - orderDiscount);
  const costTotal = rows.reduce((a, r) => a + r.cost, 0);
  const commissionBasisTotal = rows.reduce((a, r) => a + r.commissionBasis, 0);

  const { data: plan, error: planErr } = await supabase
    .from("commission_plans")
    .select("base_calc, default_rate")
    .eq("id", sale.commission_plan_id)
    .single();

  if (planErr || !plan) {
    return {
      ok: false as const,
      error: planErr?.message ?? "No se pudo leer el plan de comisión.",
    };
  }

  const commissionRate = toNum(plan.default_rate);
  const commissionBaseCalc: "sale" | "margin" =
    plan.base_calc === "margin" ? "margin" : "sale";

  const margin = Math.max(0, netTotal - costTotal);
  const commissionBase =
    commissionBaseCalc === "margin" ? margin : commissionBasisTotal;

  const totalCommission = Math.max(0, commissionBase * commissionRate);
  const companyProfit = Math.max(0, netTotal - costTotal - totalCommission);

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
      order_discount: orderDiscount,
    })
    .eq("id", saleId);

  if (upSaleErr) {
    return { ok: false as const, error: upSaleErr.message };
  }

  return { ok: true as const };
}

export async function createSaleWithItems(input: {
  sale: SaleInsert;
  items: SaleItemInsert[];
}) {
  const supabase = await createClient();

  if (!input.items.length) {
    return {
      ok: false as const,
      error: "La venta debe tener al menos 1 ítem.",
    };
  }

  const gross = input.items.reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0,
  );
  const discount = input.items.reduce((a, it) => a + toNum(it.discount), 0);
  const orderDiscount = toNum(input.sale.order_discount);
  const net = Math.max(0, gross - discount - orderDiscount);

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
      order_discount: orderDiscount,
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

  const itemsPayload = input.items.map((it) => ({
    sale_id: saleId,
    product_id: it.product_id,
    qty: toNum(it.qty),
    unit_price: toNum(it.unit_price),
    discount: toNum(it.discount) || 0,
    options: it.options ?? null,
  }));

  const { error: itemsErr } = await supabase
    .from("sale_items")
    .insert(itemsPayload);

  if (itemsErr) {
    await supabase.from("sales").delete().eq("id", saleId);
    return { ok: false as const, error: itemsErr.message };
  }

  if (input.sale.status === "confirmed") {
    const snap = await computeAndFreezeOnConfirm({ supabase, saleId });
    if (!snap.ok) {
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
    .select(
      "id, qty, unit_price, discount, cost_at_sale, options, product:products(name, cost)",
    )
    .eq("sale_id", saleId)
    .order("id", { ascending: true });

  if (error) {
    return { ok: false as const, error: error.message, items: [] as any[] };
  }

  return { ok: true as const, items: data ?? [] };
}

export async function updateSaleStatusAndAddItems(input: {
  saleId: string;
  status: SaleStatus;
  items?: SaleItemInsert[];
  payment_method?: PaymentMethod;
  invoice_number?: string | null;
  paid?: boolean;
  order_discount?: number;
}) {
  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from("sale_items")
    .select("qty, unit_price, discount")
    .eq("sale_id", input.saleId);

  if (exErr) return { ok: false as const, error: exErr.message };

  const baseGross = (existing ?? []).reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0,
  );
  const baseDiscount = (existing ?? []).reduce(
    (a, it) => a + toNum(it.discount),
    0,
  );

  const newItems = (input.items ?? []).filter(
    (it) => it.product_id && toNum(it.qty) > 0,
  );

  if (newItems.length) {
    const payload = newItems.map((it) => ({
      sale_id: input.saleId,
      product_id: it.product_id,
      qty: toNum(it.qty),
      unit_price: toNum(it.unit_price),
      discount: toNum(it.discount) || 0,
      options: it.options ?? null,
    }));

    const { error: insErr } = await supabase.from("sale_items").insert(payload);
    if (insErr) return { ok: false as const, error: insErr.message };
  }

  const addGross = newItems.reduce(
    (a, it) => a + toNum(it.qty) * toNum(it.unit_price),
    0,
  );
  const addDiscount = newItems.reduce(
    (a, it) => a + (toNum(it.discount) || 0),
    0,
  );

  const gross = baseGross + addGross;
  const discount = baseDiscount + addDiscount;
  const orderDiscount = toNum(input.order_discount);
  const net = Math.max(0, gross - discount - orderDiscount);

  const { error: upErr } = await supabase
    .from("sales")
    .update({
      status: input.status,
      total_gross: gross,
      total_discount: discount,
      total_net: net,
      order_discount: orderDiscount,
      payment_method: input.payment_method ?? undefined,
      invoice_number: input.invoice_number ?? undefined,
      paid_at: input.paid ? new Date().toISOString() : undefined,
    })
    .eq("id", input.saleId);

  if (upErr) return { ok: false as const, error: upErr.message };

  if (input.status === "confirmed") {
    const snap = await computeAndFreezeOnConfirm({
      supabase,
      saleId: input.saleId,
    });
    if (!snap.ok) return snap;
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function cancelSale(input: {
  saleId: string;
  reason: string;
  observation?: string | null;
}) {
  const supabase = await createClient();

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, status")
    .eq("id", input.saleId)
    .single();

  if (saleErr || !sale) {
    return { ok: false as const, error: saleErr?.message ?? "Venta no existe." };
  }

  if (sale.status === "confirmed") {
    return {
      ok: false as const,
      error: "La venta ya está confirmada/cerrada. No se puede cancelar.",
    };
  }

  const { error } = await supabase
    .from("sales")
    .update({
      status: "cancelled",
      cancel_reason: input.reason,
      cancelled_at: new Date().toISOString(),
      notes: input.observation?.trim() || null,
    })
    .eq("id", input.saleId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function refreshSalePrices(saleId: string) {
  const supabase = await createClient();

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, status, order_discount")
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) {
    return {
      ok: false as const,
      error: saleErr?.message ?? "Venta no existe.",
    };
  }

  if (sale.status === "confirmed") {
    return {
      ok: false as const,
      error: "La venta está confirmada. No se puede actualizar.",
    };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("id, product_id, qty, discount, options")
    .eq("sale_id", saleId);

  if (itemsErr) return { ok: false as const, error: itemsErr.message };

  const productIds = Array.from(
    new Set((items ?? []).map((i: any) => i.product_id).filter(Boolean)),
  );

  if (!productIds.length) return { ok: true as const };

  const { data: prods, error: prodsErr } = await supabase
    .from("products")
    .select("id, list_price, has_complexity_pricing, complexity_tiers")
    .in("id", productIds);

  if (prodsErr) return { ok: false as const, error: prodsErr.message };

  const productById = new Map((prods ?? []).map((p: any) => [p.id, p]));

  // Para ítems con niveles de complejidad, recalculamos el precio base
  // buscando el nivel elegido (por nombre) entre los niveles ACTUALES del
  // producto, y le volvemos a sumar los mismos adicionales elegidos en su
  // momento. Si el nivel ya no existe, dejamos el precio como estaba.
  function recomputeUnitPrice(it: any): number {
    const product = productById.get(it.product_id);
    const options = it.options;

    if (product?.has_complexity_pricing && options?.complexity) {
      const currentTier = (product.complexity_tiers ?? []).find(
        (t: any) => t.label === options.complexity.label,
      );
      const basePrice = Number(currentTier?.price ?? options.complexity.price) || 0;
      const addonsPct = (options.addons ?? []).reduce(
        (a: number, ad: any) => a + (Number(ad.pct) || 0),
        0,
      );
      return basePrice * (1 + addonsPct);
    }

    return Number(product?.list_price) || 0;
  }

  const unitPriceById = new Map(
    (items ?? []).map((it: any) => [it.id, recomputeUnitPrice(it)]),
  );

  const updates = (items ?? []).map((it: any) => ({
    id: it.id,
    unit_price: unitPriceById.get(it.id) ?? 0,
  }));

  for (const u of updates) {
    const { error } = await supabase
      .from("sale_items")
      .update({ unit_price: u.unit_price })
      .eq("id", u.id);

    if (error) return { ok: false as const, error: error.message };
  }

  let gross = 0;
  let discount = 0;

  for (const it of (items ?? []) as any[]) {
    const qty = Number(it.qty) || 0;
    const unit = unitPriceById.get(it.id) ?? 0;
    const disc = Number(it.discount) || 0;
    gross += qty * unit;
    discount += disc;
  }

  const orderDiscount = toNum(sale.order_discount);
  const net = Math.max(0, gross - discount - orderDiscount);

  const { error: upErr } = await supabase
    .from("sales")
    .update({
      total_gross: gross,
      total_discount: discount,
      total_net: net,
      order_discount: orderDiscount,
    })
    .eq("id", saleId);

  if (upErr) return { ok: false as const, error: upErr.message };

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

// Permite cargar/corregir el costo real de un ítem (ej: filamento usado)
// una vez conocido, típicamente después de imprimir. No toca lo que se le
// facturó al cliente (unit_price/discount/total_net quedan igual): solo
// recalcula costo, comisión (si el plan es por margen) y margen de Lambda.
export async function updateSaleItemCost(itemId: string, newCost: number) {
  const supabase = await createClient();

  if (!Number.isFinite(newCost) || newCost < 0) {
    return { ok: false as const, error: "Costo inválido." };
  }

  const { data: item, error: itemErr } = await supabase
    .from("sale_items")
    .select("id, sale_id")
    .eq("id", itemId)
    .single();

  if (itemErr || !item) {
    return { ok: false as const, error: itemErr?.message ?? "Ítem no encontrado." };
  }

  const { error: updErr } = await supabase
    .from("sale_items")
    .update({ cost_at_sale: newCost })
    .eq("id", itemId);

  if (updErr) return { ok: false as const, error: updErr.message };

  const saleId = item.sale_id as string;

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select(
      "id, total_gross, total_discount, total_net, order_discount, commission_plan_id, commission_rate_at_sale, commission_base_calc_at_sale",
    )
    .eq("id", saleId)
    .single();

  if (saleErr || !sale) {
    return { ok: false as const, error: saleErr?.message ?? "Venta no encontrada." };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("qty, unit_price, discount, cost_at_sale, options")
    .eq("sale_id", saleId);

  if (itemsErr) return { ok: false as const, error: itemsErr.message };

  const costTotal = (items ?? []).reduce(
    (a: number, it: any) => a + toNum(it.cost_at_sale) * toNum(it.qty),
    0,
  );

  // Misma regla que al confirmar: para Biomodelo, la comisión se calcula
  // sobre el precio BASE (sin adicionales), no sobre el bruto facturado.
  const commissionBasisTotal = (items ?? []).reduce((a: number, it: any) => {
    const qty = toNum(it.qty);
    const unit = toNum(it.unit_price);
    const basis = it.options?.complexity
      ? getBiomodeloBaseUnitPrice(unit, it.options) * qty
      : unit * qty;
    return a + basis;
  }, 0);

  let commissionRate = toNum(sale.commission_rate_at_sale);
  let commissionBaseCalc: "sale" | "margin" =
    sale.commission_base_calc_at_sale === "margin" ? "margin" : "sale";

  if (!sale.commission_rate_at_sale && sale.commission_plan_id) {
    const { data: plan } = await supabase
      .from("commission_plans")
      .select("base_calc, default_rate")
      .eq("id", sale.commission_plan_id)
      .single();

    if (plan) {
      commissionRate = toNum(plan.default_rate);
      commissionBaseCalc = plan.base_calc === "margin" ? "margin" : "sale";
    }
  }

  const netTotal = toNum(sale.total_net);
  const margin = Math.max(0, netTotal - costTotal);
  const commissionBase =
    commissionBaseCalc === "margin" ? margin : commissionBasisTotal;
  const totalCommission = Math.max(0, commissionBase * commissionRate);
  const companyProfit = Math.max(0, netTotal - costTotal - totalCommission);

  const { error: upErr } = await supabase
    .from("sales")
    .update({
      total_cost: costTotal,
      total_commission: totalCommission,
      company_profit: companyProfit,
    })
    .eq("id", saleId);

  if (upErr) return { ok: false as const, error: upErr.message };

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function assignBudgetNumber(saleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("assign_budget_number", {
    p_sale_id: saleId,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, budgetNumber: Number(data) };
}
