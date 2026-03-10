"use client";

import * as React from "react";
import { Calendar, CalendarDays, Users, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardFiltersProps {
  period: string;
  onPeriodChange: (value: string) => void;
  seller: string;
  onSellerChange: (value: string) => void;
  sellers: { id: string; name: string }[];
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

function formatRange(range: DateRange | undefined) {
  if (!range?.from && !range?.to) return "Rango de fechas";
  const from = range?.from ? range.from.toLocaleDateString("es-AR") : "—";
  const to = range?.to ? range.to.toLocaleDateString("es-AR") : "—";
  return `${from} - ${to}`;
}

export function DashboardFilters({
  period,
  onPeriodChange,
  seller,
  onSellerChange,
  sellers,
  dateRange,
  onDateRangeChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period */}
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger className="h-9 w-[210px] gap-2 bg-card text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-quarter">Este trimestre</SelectItem>
          <SelectItem value="this-month">Este mes</SelectItem>
          <SelectItem value="last-month">Mes pasado</SelectItem>
          <SelectItem value="last-quarter">Trimestre pasado</SelectItem>
          <SelectItem value="this-year">Este año</SelectItem>
        </SelectContent>
      </Select>

      {/* Real date range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 w-[260px] justify-start gap-2 bg-card text-sm"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{formatRange(dateRange)}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex items-center justify-between gap-2 pb-2">
            <div className="text-sm font-medium">Rango de fechas</div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDateRangeChange(undefined)}
              title="Limpiar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <UICalendar
            mode="range"
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Seller */}
      <Select value={seller} onValueChange={onSellerChange}>
        <SelectTrigger className="h-9 w-[240px] gap-2 bg-card text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los vendedores</SelectItem>
          {sellers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}