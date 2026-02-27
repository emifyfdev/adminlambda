// lib/repos/sales-repo.ts
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type SaleStatus = "pending" | "confirmed" | "cancelled" | "returned"

export type SaleInsert = {
  sold_at: string // ISO string
  seller_id: string
  customer_name?: string | null
  channel?: string | null
  status: SaleStatus
  notes?: string | null
  commission_plan_id: string 
}

export type SaleItemInsert = {
  product_id: string
  qty: number
  unit_price: number
  discount: number
}

export async function createSaleWithItems(input: {
  sale: SaleInsert
  items: SaleItemInsert[]
}) {
  const supabase = await createClient()
const gross = input.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
const discount = input.items.reduce((a, it) => a + (Number(it.discount) || 0), 0)
const net = Math.max(0, gross - discount)

  if (!input.items.length) {
    return { ok: false as const, error: "La venta debe tener al menos 1 ítem." }
  }

  // 1) Insert sale
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
    .single()

  if (saleErr || !saleRow?.id) {
    return { ok: false as const, error: saleErr?.message ?? "Error creando venta." }
  }

  const saleId = saleRow.id as string

  // 2) Insert items
  const itemsPayload = input.items.map((it) => ({
    sale_id: saleId,
    product_id: it.product_id,
    qty: it.qty,
    unit_price: it.unit_price,
    discount: it.discount ?? 0,
  }))

  const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload)

  if (itemsErr) {
    // rollback simple (borramos la cabecera) si fallan items
    await supabase.from("sales").delete().eq("id", saleId)
    return { ok: false as const, error: itemsErr.message }
  }

  revalidatePath("/sales")
  revalidatePath("/dashboard")
  return { ok: true as const, saleId }
}

export async function getSales() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("sold_at", { ascending: false })

  if (error) {
    console.error("getSales error:", error)
    return []
  }
  return data ?? []
}
export async function getSaleDetail(saleId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("sale_items")
    .select("id, qty, unit_price, discount, product:products(name)")
    .eq("sale_id", saleId)
    .order("id", { ascending: true })

  if (error) return { ok: false as const, error: error.message, items: [] as any[] }
  return { ok: true as const, items: data ?? [] }
}