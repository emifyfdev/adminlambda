"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts"

interface SalesRevenueChartProps {
  data: { month: string; revenue: number; sales: number }[]
}

export function SalesRevenueChart({ data }: SalesRevenueChartProps) {
  return (
    <Card className="flex-1 border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          <span className="font-bold">{"Ventas e ingresos"}</span>{" "}
          <span className="font-normal text-muted-foreground">en el tiempo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-primary" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-chart-2/40" />
            Ventas
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()}`, name]}
            />
            <Bar dataKey="sales" fill="var(--color-chart-2)" opacity={0.35} radius={[2, 2, 0, 0]} barSize={20} isAnimationActive={false} />
            <Line dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--color-primary)" }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface CommissionsChartProps {
  data: { month: string; commissions: number }[]
}

export function CommissionsChart({ data }: CommissionsChartProps) {
  return (
    <Card className="flex-1 border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          <span className="font-bold">Comisiones</span>{" "}
          <span className="font-normal text-muted-foreground">en el tiempo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-chart-3" />
            Comisiones
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Comisiones"]}
            />
            <Area
              dataKey="commissions"
              stroke="var(--color-chart-3)"
              strokeWidth={2.5}
              fill="var(--color-chart-3)"
              fillOpacity={0.15}
              dot={{ r: 3, fill: "var(--color-chart-3)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
