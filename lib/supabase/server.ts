// lib/supabase/server.ts
import { headers, cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

type CookieKV = { name: string; value: string }
type CookieToSet = { name: string; value: string; options?: Record<string, any> }

function parseCookieHeader(cookieHeader: string | null): CookieKV[] {
  if (!cookieHeader) return []
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=")
      const name = i >= 0 ? c.slice(0, i) : c
      const value = i >= 0 ? c.slice(i + 1) : ""
      return { name, value }
    })
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  // En tu Next, cookies() es async
  const cookieStore = await cookies()

  // Para getAll sin depender de cookieStore.getAll()
  const cookieHeader = (await headers()).get("cookie")
  const requestCookies = parseCookieHeader(cookieHeader)

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return requestCookies
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            // En Next se puede setear así:
            cookieStore.set(name, value, options as any)
          } catch {
            // En algunos contextos no se puede setear cookies: ignorar
          }
        })
      },
    },
  })
}