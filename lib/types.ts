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

export type Product = {
  id: string
  name: string
  category: ProductCategory
  sku: string | null
  list_price: number
  cost: number
  status: ProductStatus
  created_at: string
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


export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "MERCADO_PAGO",
  "OTRO",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];