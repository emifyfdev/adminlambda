"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type LiquidationStatus = "draft" | "review" | "finalized" | "locked"

export type LiquidationRow = {
  id: string
  period_start: string // YYYY-MM-DD
  period_end: string   // YYYY-MM-DD
  frequency: "monthly" | "quarterly" | "custom"
  status: LiquidationStatus
  created_at: string
}

export type LiquidationLineRow = {
  id: string
  liquidation_id: string
  seller_id: string
  gross_total: number
  discount_total: number
  net_total: number
  cost_total: number
  commission_total: number
  company_profit: number
  created_at: string
}

export async function getLiquidations(): Promise<LiquidationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("liquidations")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getLiquidations error:", error)
    return []
  }
  return (data ?? []) as LiquidationRow[]
}

export async function getLiquidationDetail(liquidationId: string) {
  const supabase = await createClient()

  const { data: liq, error: liqErr } = await supabase
    .from("liquidations")
    .select("*")
    .eq("id", liquidationId)
    .single()

  if (liqErr || !liq) {
    return { ok: false as const, error: liqErr?.message ?? "No existe", liquidation: null, lines: [] as LiquidationLineRow[] }
  }

  const { data: lines, error: linesErr } = await supabase
    .from("liquidation_lines")
    .select("*")
    .eq("liquidation_id", liquidationId)

  if (linesErr) {
    return { ok: false as const, error: linesErr.message, liquidation: liq, lines: [] as LiquidationLineRow[] }
  }

  return { ok: true as const, liquidation: liq as LiquidationRow, lines: (lines ?? []) as LiquidationLineRow[] }
}

export async function setLiquidationStatus(liquidationId: string, status: LiquidationStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("liquidations")
    .update({ status })
    .eq("id", liquidationId)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/liquidations")
  return { ok: true as const }
}

function ymdToDateRange(month: string) {
  // month: "YYYY-MM"
  const [y, m] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0)) // último día del mes
  const toYMD = (d: Date) => d.toISOString().slice(0, 10)
  return { period_start: toYMD(start), period_end: toYMD(end) }
}

export async function generateMonthlyLiquidation(input: { month: string }) {
  const supabase = await createClient()
  const { period_start, period_end } = ymdToDateRange(input.month)

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
    .single()

  if (liqErr || !liq?.id) {
    return { ok: false as const, error: liqErr?.message ?? "Error creando liquidación" }
  }

  const liquidationId = liq.id as string

  // 2) traer ventas confirmadas del período con items+product cost y plan rate
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select(`
      id, seller_id, sold_at, status, commission_plan_id,
      items:sale_items(qty, unit_price, discount, product:products(cost)),
      plan:commission_plans(default_rate, base_calc)
    `)
    .eq("status", "confirmed")
    .gte("sold_at", `${period_start}T00:00:00.000Z`)
    .lte("sold_at", `${period_end}T23:59:59.999Z`)

  if (salesErr) return { ok: false as const, error: salesErr.message }

  // 3) acumular por seller
  const acc = new Map<string, any>()

  for (const s of (sales ?? []) as any[]) {
    const sellerId = s.seller_id as string
    if (!sellerId) continue

    const items = (s.items ?? []) as any[]
    let gross = 0
    let discount = 0
    let net = 0
    let cost = 0

    for (const it of items) {
      const qty = Number(it.qty) || 0
      const unit = Number(it.unit_price) || 0
      const disc = Number(it.discount) || 0 // descuento monto (ya lo guardás así)
      const lineGross = qty * unit
      const lineNet = Math.max(0, lineGross - disc)

      gross += lineGross
      discount += disc
      net += lineNet
      cost += (Number(it.product?.cost) || 0) * qty
    }

    const rate = Number(s.plan?.default_rate) || 0
    const baseCalc = (s.plan?.base_calc as "sale" | "margin") ?? "sale"
    const base = baseCalc === "margin" ? (net - cost) : net
    const commission = Math.max(0, base * rate)
    const profit = net - cost - commission

    const prev = acc.get(sellerId)
    if (!prev) {
      acc.set(sellerId, {
        seller_id: sellerId,
        gross_total: gross,
        discount_total: discount,
        net_total: net,
        cost_total: cost,
        commission_total: commission,
        company_profit: profit,
      })
    } else {
      prev.gross_total += gross
      prev.discount_total += discount
      prev.net_total += net
      prev.cost_total += cost
      prev.commission_total += commission
      prev.company_profit += profit
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
  }))

  if (linesPayload.length) {
    const { error: linesErr } = await supabase.from("liquidation_lines").insert(linesPayload)
    if (linesErr) return { ok: false as const, error: linesErr.message }
  }

  revalidatePath("/liquidations")
  return { ok: true as const, liquidationId }
}