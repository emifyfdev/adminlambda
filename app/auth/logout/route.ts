import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/login"

  try {
    const supabase = await createClient()
    await supabase.auth.signOut() // esto debería limpiar cookies via setAll
  } catch {
    // aunque falle, igual redirigimos
  }

  return NextResponse.redirect(new URL(next, url.origin))
}