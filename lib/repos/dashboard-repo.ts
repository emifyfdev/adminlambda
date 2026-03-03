// lib/repos/dashboard-repo.ts
"use server"

import { createClient } from "@/lib/supabase/server"

type PeriodKey =
  | "this-quarter"
  | "this-month"
  | "last-month"
  | "last-quarter"
  | "this-year"
  | string

type Input = {
  period: PeriodKey
  seller: string
  dateFrom?: string
  dateTo?: string
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}
function startOfQuarter(d: Date) {
  const x = startOfDay(d)
  const m = x.getMonth()
  const qStart = Math.floor(m / 3) * 3
  x.setMonth(qStart, 1)
  return x
}
function startOfYear(d: Date) {
  const x = startOfDay(d)
  x.setMonth(0, 1)
  return x
}
function addMonths(d: Date, months: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  x.setDate(x.getDate() + diff)
  return x
}
function getRange(period: PeriodKey) {
  const now = new Date()

  if (period === "this-month") {
    const start = startOfMonth(now)
    const end = addMonths(start, 1)
    return { start, end }
  }
  if (period === "last-month") {
    const thisM = startOfMonth(now)
    const start = addMonths(thisM, -1)
    const end = thisM
    return { start, end }
  }
  if (period === "this-quarter") {
    const start = startOfQuarter(now)
    const end = addMonths(start, 3)
    return { start, end }
  }
  if (period === "last-quarter") {
    const thisQ = startOfQuarter(now)
    const start = addMonths(thisQ, -3)
    const end = thisQ
    return { start, end }
  }
  if (period === "this-year") {
    const start = startOfYear(now)
    const end = addMonths(start, 12)
    return { start, end }
  }

  const start = startOfQuarter(now)
  const end = addMonths(start, 3)
  return { start, end }
}

function pickBucket(start: Date, end: Date) {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 35) return "day"
  if (days <= 120) return "week"
  return "month"
}

function bucketKey(kind: "day" | "week" | "month", d: Date) {
  if (kind === "day") return iso(startOfDay(d))
  if (kind === "week") return iso(startOfWeekMonday(d))
  return iso(startOfMonth(d))
}

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? "A"
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (a + b).toUpperCase()
}

export async function getDashboardData(input: Input) {
  const supabase = await createClient()

  // rango: si viene custom, pisa al period
  let { start, end } = getRange(input.period)
  if (input.dateFrom && input.dateTo) {
    const s = new Date(input.dateFrom)
    const e = new Date(input.dateTo)
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      start = s
      end = e
    }
  }

  const bucket = pickBucket(start, end)

  // sellers para el filtro (siempre desde BD)
  const { data: sellersAll, error: sellersErr } = await supabase
    .from("sellers")
    .select("id, name, sales_team")
    .order("name", { ascending: true })

  if (sellersErr) throw new Error(sellersErr.message)

  const sellers = (sellersAll ?? []).map((s: any) => ({
    id: s.id,
    name: s.name ?? s.name ?? "Vendedor",
    sales_team: s.sales_team ?? null,
  }))

  const sellerNameById = new Map(sellers.map((s) => [s.id, s.name]))
const sellerTeamById = new Map(sellers.map((s) => [s.id, s.sales_team]))
  // helper para ventas
  const fetchSales = async (sellerId?: string) => {
    let q = supabase
      .from("sales")
      .select("id, sold_at, seller_id, status, total_net, commission_plan_id")
      .gte("sold_at", start.toISOString())
      .lt("sold_at", end.toISOString())

    if (sellerId && sellerId !== "all") q = q.eq("seller_id", sellerId)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{
      id: string
      sold_at: string
      seller_id: string
      status: string
      total_net: number | null
      commission_plan_id: string | null
    }>
  }

  // ventas filtradas (KPIs / charts)
  const salesFiltered = await fetchSales(input.seller)
  // ventas para top sellers (sin filtro vendedor)
  const salesForTop = await fetchSales("all")

  const confirmedFiltered = salesFiltered.filter((s) => s.status === "confirmed")
  const confirmedTop = salesForTop.filter((s) => s.status === "confirmed")

  // unimos ids para traer items/planes una sola vez
  const allConfirmed = [...confirmedFiltered, ...confirmedTop]
  const saleIds = Array.from(new Set(allConfirmed.map((s) => s.id)))
  const planIds = Array.from(
    new Set(allConfirmed.map((s) => s.commission_plan_id).filter(Boolean)),
  ) as string[]

  const { data: plans, error: plansErr } = planIds.length
    ? await supabase
        .from("commission_plans")
        .select("id, base_calc, default_rate")
        .in("id", planIds)
    : { data: [], error: null as any }
  if (plansErr) throw new Error(plansErr.message)

  const planById = new Map(
    (plans ?? []).map((p: any) => [
      p.id,
      { base_calc: p.base_calc as "sale" | "margin", rate: Number(p.default_rate) || 0 },
    ]),
  )

  const { data: items, error: itemsErr } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("sale_id, qty, product:products(cost)")
        .in("sale_id", saleIds)
    : { data: [], error: null as any }
  if (itemsErr) throw new Error(itemsErr.message)

  const costBySale = new Map<string, number>()
  for (const it of (items ?? []) as any[]) {
    const saleId = String(it.sale_id)
    const qty = Number(it.qty) || 0
    const cost = Number(it.product?.cost) || 0
    costBySale.set(saleId, (costBySale.get(saleId) ?? 0) + qty * cost)
  }

  // ===== KPIs + series (SOLO filtradas) =====
  let totalSales = 0
  let revenue = 0
  let commissions = 0
  let netProfit = 0

  const revenueBucket = new Map<string, { revenue: number; sales: number }>()
  const commBucket = new Map<string, number>()

  for (const s of confirmedFiltered) {
    totalSales += 1
    const net = Number(s.total_net) || 0
    revenue += net

    const cost = costBySale.get(s.id) ?? 0
    const plan = s.commission_plan_id ? planById.get(s.commission_plan_id) : null
    const base = plan?.base_calc === "margin" ? Math.max(0, net - cost) : net
    const comm = Math.max(0, base * (plan?.rate ?? 0))
    commissions += comm

    const company = Math.max(0, net - cost - comm)
    netProfit += company

    const key = bucketKey(bucket as any, new Date(s.sold_at))
    const rb = revenueBucket.get(key) ?? { revenue: 0, sales: 0 }
    rb.revenue += net
    rb.sales += 1
    revenueBucket.set(key, rb)
    commBucket.set(key, (commBucket.get(key) ?? 0) + comm)
  }

  const salesRevenueOverTime = Array.from(revenueBucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, revenue: v.revenue, sales: v.sales }))

  const commissionsOverTime = Array.from(commBucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, commissions]) => ({ month, commissions }))

  // ===== Top sellers (SIN filtro vendedor) =====
  const bySeller = new Map<
    string,
    {
      seller_id: string
      name: string
      avatar: string
      sales: number
      revenue: number
      commissions: number
      netProfit: number
    }
  >()

  for (const s of confirmedTop) {
    const net = Number(s.total_net) || 0
    const cost = costBySale.get(s.id) ?? 0
    const plan = s.commission_plan_id ? planById.get(s.commission_plan_id) : null
    const base = plan?.base_calc === "margin" ? Math.max(0, net - cost) : net
    const comm = Math.max(0, base * (plan?.rate ?? 0))
    const company = Math.max(0, net - cost - comm)

    const sid = s.seller_id
    const name = sellerNameById.get(sid) ?? "Vendedor"

    const row =
      bySeller.get(sid) ??
      {
        seller_id: sid,
        name,
        avatar: initials(name),
        sales: 0,
        revenue: 0,
        commissions: 0,
        netProfit: 0,
      }

    row.sales += 1
    row.revenue += net
    row.commissions += comm
    row.netProfit += company
    bySeller.set(sid, row)
  }

  const topSellers = Array.from(bySeller.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((r, idx) => ({
      rank: idx + 1,
      sellerId: r.seller_id,
      name: r.name,
      avatar: r.avatar,
      sales: r.sales,
      revenue: r.revenue,
      commissions: r.commissions,
      netProfit: r.netProfit,
      salesTeam: sellerTeamById.get(r.seller_id) ?? null, // ✅ NUEVO
    }))

  return {
    kpis: { totalSales, revenue, commissions, netProfit },
    salesRevenueOverTime,
    commissionsOverTime,
    topSellers,
    sellers,
  }
}