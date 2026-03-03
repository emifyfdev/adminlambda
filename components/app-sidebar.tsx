"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Home,
  ShoppingCart,
  Users,
  Package,
  FileText,
  Wallet,
  Shield,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Image from "next/image"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/sales", label: "Ventas", icon: ShoppingCart },
  { href: "/sellers", label: "Vendedores", icon: Users },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/commission-plans", label: "Planes de Comisión", icon: FileText },
  { href: "/liquidations", label: "Liquidaciones", icon: Wallet },
  { href: "/audit", label: "Auditoría", icon: Shield },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
<div className="flex h-14 items-center justify-center border-b border-sidebar-border px-3">
  <Button
    variant="ghost"
    onClick={() => setCollapsed(!collapsed)}
    className="h-10 px-2 rounded-md hover:bg-sidebar-accent"
    aria-label="Toggle sidebar"
  >
    {collapsed ? (
      <Image
        src="/logo-icon.png"
        alt="Logo"
        width={28}
        height={28}
        className="object-contain"
        priority
      />
    ) : (
      <div className="flex items-center gap-2">
        {/* <Image
          src="/logo-icon.png"
          alt="Logo"
          width={28}
          height={28}
          className="object-contain"
          priority
        /> */}
        <Image
          src="/logo-text.png"
          alt="Tu Empresa"
          width={120}
          height={24}
          className="object-contain"
          priority
        />
      </div>
    )}
  </Button>
</div>

      <TooltipProvider delayDuration={0}>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.href}>{linkContent}</div>
          })}
        </nav>
      </TooltipProvider>
    </aside>
  )
}
