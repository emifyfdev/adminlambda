// components/dashboard/dashboard-contents.tsx
"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { KPICards } from "@/components/dashboard/kpi-cards";
import {
  SalesRevenueChart,
  CommissionsChart,
} from "@/components/dashboard/dashboard-charts";
import { TopSellersTable } from "@/components/dashboard/top-sellers-table";
import { getDashboardData } from "@/lib/repos/dashboard-repo";

type SellerOption = { id: string; name: string };

type DashboardData = {
  kpis: {
    totalSales: number;
    revenue: number;
    commissions: number;
    netProfit: number;
  };
  salesRevenueOverTime: { month: string; revenue: number; sales: number }[];
  commissionsOverTime: { month: string; commissions: number }[];
  topSellers: {
    rank: number;
    sellerId: string;
    name: string;
    avatar: string;
    sales: number;
    revenue: number;
    commissions: number;
    netProfit: number;
  }[];
  sellers: SellerOption[];
};

export function DashboardContents({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const [period, setPeriod] = useState("this-quarter");
  const [seller, setSeller] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const from = dateRange?.from ? new Date(dateRange.from) : undefined;
        const toBase = (dateRange?.to ?? dateRange?.from)
          ? new Date(dateRange.to ?? dateRange.from!)
          : undefined;

        let dateFrom: string | undefined;
        let dateTo: string | undefined;

        if (from && toBase) {
          // inicio del día local
          from.setHours(0, 0, 0, 0);

          // fin EXCLUSIVO: día siguiente 00:00 local
          const toExclusive = new Date(toBase);
          toExclusive.setHours(0, 0, 0, 0);
          toExclusive.setDate(toExclusive.getDate() + 1);

          dateFrom = from.toISOString();
          dateTo = toExclusive.toISOString();
        }

        const next = await getDashboardData({ period, seller, dateFrom, dateTo });
        if (!alive) return;
        setData(next);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Error al cargar el dashboard.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [period, seller, dateRange?.from, dateRange?.to]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        <DashboardFilters
          period={period}
          onPeriodChange={(v) => {
            setPeriod(v);
            setDateRange(undefined); // evita superposición con custom range
          }}
          seller={seller}
          onSellerChange={setSeller}
          sellers={data.sellers}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {err ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {err}
          </div>
        ) : null}

        <KPICards data={data.kpis} />

        <div className="flex flex-col gap-4 lg:flex-row">
          <SalesRevenueChart data={data.salesRevenueOverTime} />
          <CommissionsChart data={data.commissionsOverTime} />
        </div>

        <TopSellersTable data={data.topSellers} />

        {loading ? (
          <div className="text-xs text-muted-foreground">
            Actualizando datos…
          </div>
        ) : null}
      </div>
    </main>
  );
}