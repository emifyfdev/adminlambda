// ── Status Enums ──
export type SaleStatus = "completed" | "pending" | "cancelled" | "returned"
export type SaleChannel = "online" | "in-store" | "phone" | "referral"
export type LiquidationStatus = "draft" | "review" | "finalized" | "locked"
export type CommissionType = "percentage" | "flat" | "tiered"
export type PlanFrequency = "monthly" | "quarterly"
export type AuditAction = "create" | "update" | "delete" | "finalize" | "lock"
export type ProductStatus = "active" | "inactive"
export const PRODUCT_CATEGORIES = ["RITMO", "BIOLOGIA", "MEDICINA"] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]
export const SALES_TEAMS = ["GENERAL", "RITMO", "BIOLOGIA", "MEDICINA"] as const
export type SalesTeam = (typeof SALES_TEAMS)[number]

export const SALES_CHANNELS = ["PÚBLICO", "COMERCIO"] as const
export type SalesChannel = (typeof SALES_CHANNELS)[number]

// ── Core Types ──
export interface Seller {
  id: string
  name: string
  email: string
  phone: string
  team: string
  avatar: string
  status: "active" | "inactive"
  joinedAt: string
}

export type ComplexityTier = {
  label: string
  price: number
}

export type Product = {
  id: string
  name: string
  category: ProductCategory
  sku: string | null
  list_price: number
  cost: number
  status: ProductStatus
  created_at: string
  has_complexity_pricing: boolean
  complexity_tiers: ComplexityTier[] | null
}

// Adicionales exclusivos de productos con niveles de complejidad (ej: Biomodelo).
export const COMPLEXITY_ADDONS = [
  { key: "impresion_3d", label: "Impresión 3D", pct: 0.10 },
  { key: "modelado", label: "Modelado", pct: 0.05 },
  { key: "planificacion_quirurgica", label: "Planificación Quirúrgica", pct: 0.15 },
] as const

export type ComplexityAddonKey = (typeof COMPLEXITY_ADDONS)[number]["key"]

export type SaleItemOptions = {
  complexity: ComplexityTier
  addons: { key: ComplexityAddonKey; label: string; pct: number }[]
} | null

// Costo automático del "visualizador" para Biomodelo: % fijo sobre el precio
// BASE del nivel elegido (sin adicionales). La "comisión" de la venta
// (horas-hombre) también se calcula sobre ese mismo precio base.
export const BIOMODELO_VISUALIZADOR_RATE = 0.15

// A partir del unit_price final de un ítem (precio base + adicionales) y los
// adicionales que se le eligieron, devuelve el precio BASE (sin adicionales),
// ya que unit_price = base * (1 + suma de % de addons).
export function getBiomodeloBaseUnitPrice(
  unitPrice: number,
  options: SaleItemOptions | null | undefined,
): number {
  const addonPct = (options?.addons ?? []).reduce(
    (sum, a) => sum + (Number(a.pct) || 0),
    0,
  )
  return addonPct > 0 ? unitPrice / (1 + addonPct) : unitPrice
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Sale {
  id: string
  sellerId: string
  sellerName: string
  date: string
  items: SaleItem[]
  total: number
  commission: number
  status: SaleStatus
  channel: SaleChannel
}

export interface CommissionTier {
  id: string
  minAmount: number
  maxAmount: number | null
  rate: number
}

export interface BonusRule {
  id: string
  name: string
  description: string
  threshold: number
  bonus: number
  type: "flat" | "percentage"
}

export interface CommissionPlan {
  id: string
  name: string
  description: string
  type: CommissionType
  baseRate: number
  tiers: CommissionTier[]
  bonuses: BonusRule[]
  frequency: PlanFrequency
  status: "active" | "draft" | "archived"
}

export interface LiquidationLine {
  id: string
  saleId: string
  sellerId: string
  sellerName: string
  saleTotal: number
  commissionRate: number
  commissionAmount: number
  bonusAmount: number
  totalPayout: number
}

export interface Liquidation {
  id: string
  period: string
  frequency: PlanFrequency
  status: LiquidationStatus
  createdAt: string
  finalizedAt: string | null
  totalSales: number
  totalCommissions: number
  totalBonuses: number
  totalPayout: number
  lines: LiquidationLine[]
}

export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: AuditAction
  entity: string
  entityId: string
  description: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}


export const CANCEL_REASONS = [
  "Presupuesto no aceptado",
  "Error de carga",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "MERCADO_PAGO",
  "OTRO",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
