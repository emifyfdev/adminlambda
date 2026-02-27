// lib/repos/products-repo.ts
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Product, ProductStatus } from "@/lib/types"

export type ProductInsert = {
  name: string
  category?: string | null
  sku?: string | null
  list_price: number
  cost: number
  status: ProductStatus
}

export type ProductUpdate = ProductInsert & { id: string }

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getProducts error:", error)
    return []
  }

  return (data ?? []) as Product[]
}

export async function createProduct(input: ProductInsert) {
  const supabase = await createClient()

  const payload = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    sku: input.sku?.trim() || null,
    list_price: input.list_price,
    cost: input.cost,
    status: input.status,
  }

  const { error } = await supabase.from("products").insert(payload)

  if (error) {
    console.error("createProduct error:", error)
    return { ok: false as const, error: error.message }
  }

  revalidatePath("/products")
  return { ok: true as const }
}

export async function updateProduct(input: ProductUpdate) {
  const supabase = await createClient()

  const payload = {
    name: input.name.trim(),
    category: input.category?.trim() || null,
    sku: input.sku?.trim() || null,
    list_price: input.list_price,
    cost: input.cost,
    status: input.status,
  }

  const { error } = await supabase.from("products").update(payload).eq("id", input.id)

  if (error) {
    console.error("updateProduct error:", error)
    return { ok: false as const, error: error.message }
  }

  revalidatePath("/products")
  return { ok: true as const }
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) {
    console.error("deleteProduct error:", error)
    return { ok: false as const, error: error.message }
  }

  revalidatePath("/products")
  return { ok: true as const }
}