"use client"

import { useState } from "react"
import { AppTopbar } from "@/components/app-topbar"
import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesRevenueChart, CommissionsChart } from "@/components/dashboard/dashboard-charts"
import { TopSellersTable } from "@/components/dashboard/top-sellers-table"
import {
  dashboardKPIs,
  salesRevenueOverTime,
  commissionsOverTime,
  topSellers,
} from "@/lib/mock-data"

export default function DashboardPage() {
  const [period, setPeriod] = useState("this-quarter")
  const [seller, setSeller] = useState("all")

  return (
    <>
      <AppTopbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          <DashboardFilters
            period={period}
            onPeriodChange={setPeriod}
            seller={seller}
            onSellerChange={setSeller}
          />

          <KPICards data={dashboardKPIs} />

          <div className="flex flex-col gap-4 lg:flex-row">
            <SalesRevenueChart data={salesRevenueOverTime} />
            <CommissionsChart data={commissionsOverTime} />
          </div>

          <TopSellersTable data={topSellers} />
        </div>
      </main>
    </>
  )
}
