import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const err = url.searchParams.get("error")
  const errDesc = url.searchParams.get("error_description")

  if (err) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errDesc ?? err)}`, url.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Missing code")}`, url.origin)
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin))
}