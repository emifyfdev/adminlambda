"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SALES_TEAMS } from "@/lib/types";

interface TopSeller {
  rank: number;
  sellerId: string;
  name: string;
  avatar: string;
  sales: number;
  revenue: number;
  commissions: number;
  netProfit: number;
  salesTeam?: (typeof SALES_TEAMS)[number] | null; // ✅ NUEVO
}

const avatarColors = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

export function TopSellersTable({ data }: { data: TopSeller[] }) {
  const [team, setTeam] = useState<string>("ALL");
  const [topN, setTopN] = useState<number>(5);

  const filteredByTeam =
    team === "ALL" ? data : data.filter((r) => r.salesTeam === team);

  const sliced = filteredByTeam.slice(0, topN);
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-bold text-card-foreground">
          Mejores vendedores
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {SALES_TEAMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue="5">
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 pl-6 text-xs font-semibold text-muted-foreground">
                Puesto
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Vendedor
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Ventas
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Ingresos <ChevronDown className="ml-0.5 inline h-3 w-3" />
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Comisiones <ChevronDown className="ml-0.5 inline h-3 w-3" />
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Ganancia neta <ChevronDown className="ml-0.5 inline h-3 w-3" />
              </TableHead>
              <TableHead className="pr-6 text-right text-xs font-semibold text-muted-foreground">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sliced.map((seller, idx) => (
              <TableRow key={seller.sellerId} className="h-14">
                <TableCell className="pl-6 text-sm font-medium text-card-foreground">
                  {seller.rank}.
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback
                        className={`text-xs font-medium ${avatarColors[idx % avatarColors.length]}`}
                      >
                        {seller.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-card-foreground">
                      {seller.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-card-foreground">
                  {seller.sales}
                </TableCell>
                <TableCell className="text-sm text-card-foreground">
                  ${seller.revenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm text-card-foreground">
                  ${seller.commissions.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm text-card-foreground">
                  ${seller.netProfit.toLocaleString()}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button
                    size="sm"
                    className="h-8 gap-1 bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Ver
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}