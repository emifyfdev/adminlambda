// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createSupabaseMiddlewareClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  return { supabase, res };
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Nunca bloquear el callback
  if (pathname.startsWith("/auth/callback")) return NextResponse.next();
  // (Opcional sano) nunca interceptar logout
  if (pathname.startsWith("/auth/logout")) return NextResponse.next();

  const { supabase, res } = createSupabaseMiddlewareClient(req);

  const protectedPaths = [
    "/dashboard",
    "/sales",
    "/sellers",
    "/products",
    "/commission-plans",
    "/liquidations",
    "/audit",
  ];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // ✅ en middleware, usar getUser() (auth real)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  // Si NO está logueado y va a rutas protegidas -> login
  if ((!user || userErr) && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ✅ Whitelist SOLO con allowed_emails
  if (user && isProtected) {
    const email = user.email; // viene validado por getUser()
    if (!email) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Email no disponible");
      return NextResponse.redirect(url);
    }

    const { data: allow, error } = await supabase
      .from("allowed_emails")
      .select("active, role")
      .eq("email", email)
      .maybeSingle();

    // No existe fila o active=false => no autorizado
    if (error || !allow?.active) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/logout";
      url.searchParams.set("next", "/login?error=No autorizado");
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sales/:path*",
    "/sellers/:path*",
    "/products/:path*",
    "/commission-plans/:path*",
    "/liquidations/:path*",
    "/audit/:path*",
    "/login",
  ],
};