// app/login/page.tsx
import { Suspense } from "react"
import LoginClient from "./LoginClient"

function Fallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      Cargando...
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginClient />
    </Suspense>
  )
}