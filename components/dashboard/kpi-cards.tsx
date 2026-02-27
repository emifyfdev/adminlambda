import { ShoppingCart, DollarSign, Percent, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface KPIData {
  totalSales: number
  revenue: number
  commissions: number
  netProfit: number
}

const kpiConfig = [
  { key: "totalSales" as const, label: "Total Sales", icon: ShoppingCart, format: (v: number) => `${v.toLocaleString()} Sales`, color: "text-primary" },
  { key: "revenue" as const, label: "Revenue", icon: DollarSign, format: (v: number) => `$${v.toLocaleString()}`, color: "text-primary" },
  { key: "commissions" as const, label: "Commissions", icon: Percent, format: (v: number) => `$${v.toLocaleString()}`, color: "text-chart-3" },
  { key: "netProfit" as const, label: "Net Profit", icon: TrendingUp, format: (v: number) => `$${v.toLocaleString()}`, color: "text-primary" },
]

export function KPICards({ data }: { data: KPIData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiConfig.map((kpi) => (
        <Card key={kpi.key} className="border border-border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
              <span className="text-2xl font-bold text-card-foreground">{kpi.format(data[kpi.key])}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
