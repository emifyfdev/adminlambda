// lib/repos/sellers-repo.ts
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { SalesTeam } from "@/lib/types"

export type SellerStatus = "active" | "inactive"

export type SellerRow = {
  id: string
  // columnas viejas (quedan por compatibilidad)
  // columnas nuevas
  name: string | null
  email: string | null
  phone: string | null
  sales_team: SalesTeam | null

  status: SellerStatus
  created_at: string
}

export async function getSellers(): Promise<SellerRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sellers")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getSellers error:", error)
    return []
  }
  return (data ?? []) as SellerRow[]
}

export async function createSeller(input: {
  name: string
  email?: string | null
  phone?: string | null
  sales_team: SalesTeam
  status: SellerStatus
}) {
  const supabase = await createClient()

  const { error } = await supabase.from("sellers").insert({
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    sales_team: input.sales_team,
    status: input.status,

    // compat: si alguien todavía usa display_name en la UI vieja
  })

  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/sellers")
  revalidatePath("/sales")
  return { ok: true as const }
}

export async function updateSeller(input: {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  sales_team: SalesTeam
  status: SellerStatus
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("sellers")
    .update({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      sales_team: input.sales_team,
      status: input.status,

      // compat
    })
    .eq("id", input.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/sellers")
  revalidatePath("/sales")
  return { ok: true as const }
}

export async function deleteSeller(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sellers").delete().eq("id", id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/sellers")
  revalidatePath("/sales")
  return { ok: true as const }
}