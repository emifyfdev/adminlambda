"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type CommissionBase = "sale" | "margin"

export type CommissionPlan = {
  id: string
  name: string
  base_calc: CommissionBase
  default_rate: number
  active: boolean
  created_at?: string
}

export async function getCommissionPlans(): Promise<CommissionPlan[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commission_plans")
    .select("id,name,base_calc,default_rate,active,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getCommissionPlans error:", error)
    return []
  }
  return (data ?? []) as CommissionPlan[]
}

export async function getActiveCommissionPlans(): Promise<CommissionPlan[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("commission_plans")
    .select("id,name,base_calc,default_rate,active")
    .eq("active", true)
    .order("name", { ascending: true })

  if (error) {
    console.error("getActiveCommissionPlans error:", error)
    return []
  }
  return (data ?? []) as CommissionPlan[]
}

export async function createCommissionPlan(input: {
  name: string
  base_calc: CommissionBase
  default_rate: number
  active: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from("commission_plans").insert({
    name: input.name.trim(),
    base_calc: input.base_calc,
    default_rate: input.default_rate,
    active: input.active,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/commission-plans")
  return { ok: true as const }
}

export async function updateCommissionPlan(input: {
  id: string
  name: string
  base_calc: CommissionBase
  default_rate: number
  active: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("commission_plans")
    .update({
      name: input.name.trim(),
      base_calc: input.base_calc,
      default_rate: input.default_rate,
      active: input.active,
    })
    .eq("id", input.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/commission-plans")
  return { ok: true as const }
}