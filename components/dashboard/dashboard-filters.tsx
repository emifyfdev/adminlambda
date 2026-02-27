"use client"

import { Calendar, CalendarDays, Users } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DashboardFiltersProps {
  period: string
  onPeriodChange: (value: string) => void
  seller: string
  onSellerChange: (value: string) => void
}

export function DashboardFilters({
  period,
  onPeriodChange,
  seller,
  onSellerChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger className="h-9 w-44 gap-2 bg-card text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-quarter">This Quarter</SelectItem>
          <SelectItem value="this-month">This Month</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="last-quarter">Last Quarter</SelectItem>
          <SelectItem value="this-year">This Year</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="custom">
        <SelectTrigger className="h-9 w-48 gap-2 bg-card text-sm">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom Date Range</SelectItem>
        </SelectContent>
      </Select>

      <Select value={seller} onValueChange={onSellerChange}>
        <SelectTrigger className="h-9 w-40 gap-2 bg-card text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sellers</SelectItem>
          <SelectItem value="s1">Laura Gomez</SelectItem>
          <SelectItem value="s2">Martin Perez</SelectItem>
          <SelectItem value="s3">Sofia Alvarez</SelectItem>
          <SelectItem value="s4">Juan Torres</SelectItem>
          <SelectItem value="s5">Carla Ruiz</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
