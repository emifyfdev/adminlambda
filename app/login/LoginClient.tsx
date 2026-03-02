"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 533.5 544.3" aria-hidden="true" {...props}>
      <path
        fill="#4285f4"
        d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272.1v95.4h146.9c-6.3 34.1-25 62.9-53.2 82.2v68h86.1c50.4-46.4 81.6-114.8 81.6-195.2z"
      />
      <path
        fill="#34a853"
        d="M272.1 544.3c72.6 0 133.6-24 178.1-65.3l-86.1-68c-24 16.1-54.7 25.6-92 25.6-70.7 0-130.7-47.7-152.2-111.7H32.7v70.2c44.2 87.9 135.2 149.2 239.4 149.2z"
      />
      <path
        fill="#fbbc04"
        d="M119.9 324.9c-10.6-31.9-10.6-66.5 0-98.4V156.3H32.7c-38.2 76.2-38.2 165.6 0 241.8l87.2-73.2z"
      />
      <path
        fill="#ea4335"
        d="M272.1 107.7c39.5-.6 77.5 14.1 106.4 41l79.1-79.1C408.9 24.3 343.3-1 272.1 0 167.9 0 76.9 61.3 32.7 149.2l87.2 70.2c21.5-64 81.5-111.7 152.2-111.7z"
      />
    </svg>
  )
}

export default function LoginClient() {
  const router = useRouter()
  const params = useSearchParams()

  const errorMsg = params.get("error")
  const logoutFlag = params.get("logout")

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(errorMsg)

  useEffect(() => {
    if (logoutFlag === "1") {
      ;(async () => {
        try {
          const supabase = createClient()
          await supabase.auth.signOut()
        } finally {
          router.replace("/login")
        }
      })()
    }
  }, [logoutFlag, router])

  async function handleGoogle() {
    setErr(null)
    setLoading(true)

    try {
      const supabase = createClient()

      // Mejor: fallback si NEXT_PUBLIC_SITE_URL no está seteada en Vercel
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

      const redirectTo = `${siteUrl}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      })

      if (error) setErr(error.message)
      // si no hay error, Google redirige solo
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Accedé con tu cuenta de Google.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {err ? (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" onClick={handleGoogle} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Continuar con Google
          </Button>

          <p className="text-xs text-muted-foreground">
            Al continuar aceptás los términos y la política de privacidad
            (placeholder).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}