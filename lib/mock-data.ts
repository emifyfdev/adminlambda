import type {
  Seller, Product, Sale, CommissionPlan, Liquidation, AuditLog,
} from "./types"

// ── Sellers ──
export const sellers: Seller[] = [
  { id: "s1", name: "Laura Gomez", email: "laura@company.com", phone: "+1-555-0101", team: "Team Alpha", avatar: "LG", status: "active", joinedAt: "2024-03-15" },
  { id: "s2", name: "Martin Perez", email: "martin@company.com", phone: "+1-555-0102", team: "Team Alpha", avatar: "MP", status: "active", joinedAt: "2024-01-10" },
  { id: "s3", name: "Sofia Alvarez", email: "sofia@company.com", phone: "+1-555-0103", team: "Team Beta", avatar: "SA", status: "active", joinedAt: "2024-06-01" },
  { id: "s4", name: "Juan Torres", email: "juan@company.com", phone: "+1-555-0104", team: "Team Beta", avatar: "JT", status: "active", joinedAt: "2024-02-20" },
  { id: "s5", name: "Carla Ruiz", email: "carla@company.com", phone: "+1-555-0105", team: "Team Alpha", avatar: "CR", status: "active", joinedAt: "2024-04-12" },
  { id: "s6", name: "Diego Herrera", email: "diego@company.com", phone: "+1-555-0106", team: "Team Beta", avatar: "DH", status: "inactive", joinedAt: "2023-09-05" },
  { id: "s7", name: "Ana Morales", email: "ana@company.com", phone: "+1-555-0107", team: "Team Alpha", avatar: "AM", status: "active", joinedAt: "2024-07-20" },
  { id: "s8", name: "Roberto Silva", email: "roberto@company.com", phone: "+1-555-0108", team: "Team Beta", avatar: "RS", status: "active", joinedAt: "2024-05-10" },
]

// ── Products ──
export const products: Product[] = [
  { id: "p1", name: "Enterprise Suite", sku: "ENT-001", category: "Software", price: 1200, cost: 400, status: "active" },
  { id: "p2", name: "Pro Package", sku: "PRO-001", category: "Software", price: 800, cost: 250, status: "active" },
  { id: "p3", name: "Starter Kit", sku: "STR-001", category: "Software", price: 300, cost: 100, status: "active" },
  { id: "p4", name: "Support Plan - Annual", sku: "SUP-001", category: "Services", price: 500, cost: 150, status: "active" },
  { id: "p5", name: "Training Workshop", sku: "TRN-001", category: "Services", price: 250, cost: 80, status: "active" },
  { id: "p6", name: "Custom Integration", sku: "CUS-001", category: "Services", price: 2000, cost: 800, status: "active" },
  { id: "p7", name: "Hardware Module A", sku: "HW-001", category: "Hardware", price: 150, cost: 60, status: "active" },
  { id: "p8", name: "Legacy Addon", sku: "LEG-001", category: "Software", price: 100, cost: 30, status: "discontinued" },
]

// ── Sales ──
function generateSales(): Sale[] {
  const statuses: Sale["status"][] = ["completed", "completed", "completed", "completed", "pending", "cancelled", "returned"]
  const channels: Sale["channel"][] = ["online", "in-store", "phone", "referral"]
  const salesData: Sale[] = []
  let id = 1

  const months = [
    { month: 0, year: 2025, days: 31, label: "Jan" },
    { month: 1, year: 2025, days: 28, label: "Feb" },
    { month: 2, year: 2025, days: 31, label: "Mar" },
  ]

  for (const m of months) {
    const salesCount = 80 + Math.floor(Math.random() * 40)
    for (let i = 0; i < salesCount; i++) {
      const seller = sellers[Math.floor(Math.random() * 5)]
      const product = products[Math.floor(Math.random() * 7)]
      const qty = 1 + Math.floor(Math.random() * 3)
      const total = product.price * qty
      const commission = Math.round(total * 0.12)
      const day = 1 + Math.floor(Math.random() * m.days)
      const dateStr = `${m.year}-${String(m.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

      salesData.push({
        id: `sale-${String(id++).padStart(4, "0")}`,
        sellerId: seller.id,
        sellerName: seller.name,
        date: dateStr,
        items: [{ productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, total }],
        total,
        commission,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        channel: channels[Math.floor(Math.random() * channels.length)],
      })
    }
  }

  return salesData.sort((a, b) => b.date.localeCompare(a.date))
}

export const sales: Sale[] = generateSales()

// ── Derived Dashboard Data ──
export const dashboardKPIs = {
  totalSales: 1245,
  revenue: 350800,
  commissions: 42750,
  netProfit: 128600,
}

export const salesRevenueOverTime = [
  { month: "Jan W1", revenue: 95000, sales: 22000 },
  { month: "Jan W2", revenue: 105000, sales: 28000 },
  { month: "Jan W3", revenue: 115000, sales: 32000 },
  { month: "Jan W4", revenue: 110000, sales: 30000 },
  { month: "Feb W1", revenue: 120000, sales: 35000 },
  { month: "Feb W2", revenue: 125000, sales: 38000 },
  { month: "Feb W3", revenue: 140000, sales: 42000 },
  { month: "Feb W4", revenue: 155000, sales: 48000 },
  { month: "Mar W1", revenue: 160000, sales: 50000 },
  { month: "Mar W2", revenue: 170000, sales: 55000 },
  { month: "Mar W3", revenue: 175000, sales: 58000 },
  { month: "Mar W4", revenue: 190000, sales: 62000 },
]

export const commissionsOverTime = [
  { month: "Jan W1", commissions: 14500 },
  { month: "Jan W2", commissions: 15200 },
  { month: "Jan W3", commissions: 17500 },
  { month: "Jan W4", commissions: 16800 },
  { month: "Feb W1", commissions: 18200 },
  { month: "Feb W2", commissions: 17900 },
  { month: "Feb W3", commissions: 19500 },
  { month: "Feb W4", commissions: 20100 },
  { month: "Mar W1", commissions: 19800 },
  { month: "Mar W2", commissions: 20500 },
  { month: "Mar W3", commissions: 21200 },
  { month: "Mar W4", commissions: 22800 },
]

export const topSellers = [
  { rank: 1, sellerId: "s1", name: "Laura Gomez", avatar: "LG", sales: 320, revenue: 91200, commissions: 12480, netProfit: 33600 },
  { rank: 2, sellerId: "s2", name: "Martin Perez", avatar: "MP", sales: 280, revenue: 78500, commissions: 9820, netProfit: 28450 },
  { rank: 3, sellerId: "s3", name: "Sofia Alvarez", avatar: "SA", sales: 250, revenue: 68400, commissions: 8210, netProfit: 24300 },
  { rank: 4, sellerId: "s4", name: "Juan Torres", avatar: "JT", sales: 210, revenue: 62700, commissions: 7500, netProfit: 20800 },
  { rank: 5, sellerId: "s5", name: "Carla Ruiz", avatar: "CR", sales: 185, revenue: 50000, commissions: 4740, netProfit: 16500 },
]

// ── Commission Plans ──
export const commissionPlans: CommissionPlan[] = [
  {
    id: "cp1", name: "Standard Plan", description: "Default plan for all sellers", type: "percentage", baseRate: 10,
    tiers: [
      { id: "t1", minAmount: 0, maxAmount: 10000, rate: 10 },
      { id: "t2", minAmount: 10001, maxAmount: 25000, rate: 12 },
      { id: "t3", minAmount: 25001, maxAmount: null, rate: 15 },
    ],
    bonuses: [
      { id: "b1", name: "Monthly Target", description: "Hit $20k in sales", threshold: 20000, bonus: 500, type: "flat" },
    ],
    frequency: "monthly", status: "active",
  },
  {
    id: "cp2", name: "Senior Plan", description: "For senior sellers with 1yr+", type: "tiered", baseRate: 12,
    tiers: [
      { id: "t4", minAmount: 0, maxAmount: 15000, rate: 12 },
      { id: "t5", minAmount: 15001, maxAmount: 30000, rate: 15 },
      { id: "t6", minAmount: 30001, maxAmount: null, rate: 18 },
    ],
    bonuses: [
      { id: "b2", name: "Quarterly Bonus", description: "Hit $60k quarterly", threshold: 60000, bonus: 2000, type: "flat" },
      { id: "b3", name: "Top Performer", description: "Top 3 in team", threshold: 0, bonus: 3, type: "percentage" },
    ],
    frequency: "quarterly", status: "active",
  },
  {
    id: "cp3", name: "Starter Plan", description: "For new sellers in probation", type: "percentage", baseRate: 8,
    tiers: [{ id: "t7", minAmount: 0, maxAmount: null, rate: 8 }],
    bonuses: [],
    frequency: "monthly", status: "draft",
  },
]

// ── Liquidations ──
export const liquidations: Liquidation[] = [
  {
    id: "liq-001", period: "January 2025", frequency: "monthly", status: "locked",
    createdAt: "2025-02-01", finalizedAt: "2025-02-05",
    totalSales: 98500, totalCommissions: 11820, totalBonuses: 1500, totalPayout: 13320,
    lines: [
      { id: "ll1", saleId: "sale-0001", sellerId: "s1", sellerName: "Laura Gomez", saleTotal: 28800, commissionRate: 12, commissionAmount: 3456, bonusAmount: 500, totalPayout: 3956 },
      { id: "ll2", saleId: "sale-0020", sellerId: "s2", sellerName: "Martin Perez", saleTotal: 25200, commissionRate: 10, commissionAmount: 2520, bonusAmount: 500, totalPayout: 3020 },
      { id: "ll3", saleId: "sale-0040", sellerId: "s3", sellerName: "Sofia Alvarez", saleTotal: 22400, commissionRate: 10, commissionAmount: 2240, bonusAmount: 0, totalPayout: 2240 },
      { id: "ll4", saleId: "sale-0060", sellerId: "s4", sellerName: "Juan Torres", saleTotal: 12600, commissionRate: 10, commissionAmount: 1260, bonusAmount: 0, totalPayout: 1260 },
      { id: "ll5", saleId: "sale-0080", sellerId: "s5", sellerName: "Carla Ruiz", saleTotal: 9500, commissionRate: 10, commissionAmount: 950, bonusAmount: 500, totalPayout: 1450 },
    ],
  },
  {
    id: "liq-002", period: "February 2025", frequency: "monthly", status: "finalized",
    createdAt: "2025-03-01", finalizedAt: "2025-03-04",
    totalSales: 118600, totalCommissions: 14232, totalBonuses: 2000, totalPayout: 16232,
    lines: [
      { id: "ll6", saleId: "sale-0100", sellerId: "s1", sellerName: "Laura Gomez", saleTotal: 32400, commissionRate: 12, commissionAmount: 3888, bonusAmount: 500, totalPayout: 4388 },
      { id: "ll7", saleId: "sale-0120", sellerId: "s2", sellerName: "Martin Perez", saleTotal: 28300, commissionRate: 10, commissionAmount: 2830, bonusAmount: 500, totalPayout: 3330 },
      { id: "ll8", saleId: "sale-0140", sellerId: "s3", sellerName: "Sofia Alvarez", saleTotal: 26000, commissionRate: 10, commissionAmount: 2600, bonusAmount: 500, totalPayout: 3100 },
      { id: "ll9", saleId: "sale-0160", sellerId: "s4", sellerName: "Juan Torres", saleTotal: 19200, commissionRate: 10, commissionAmount: 1920, bonusAmount: 0, totalPayout: 1920 },
      { id: "ll10", saleId: "sale-0180", sellerId: "s5", sellerName: "Carla Ruiz", saleTotal: 12700, commissionRate: 10, commissionAmount: 1270, bonusAmount: 500, totalPayout: 1770 },
    ],
  },
  {
    id: "liq-003", period: "March 2025", frequency: "monthly", status: "draft",
    createdAt: "2025-04-01", finalizedAt: null,
    totalSales: 133700, totalCommissions: 16044, totalBonuses: 2500, totalPayout: 18544,
    lines: [
      { id: "ll11", saleId: "sale-0200", sellerId: "s1", sellerName: "Laura Gomez", saleTotal: 35000, commissionRate: 15, commissionAmount: 5250, bonusAmount: 500, totalPayout: 5750 },
      { id: "ll12", saleId: "sale-0220", sellerId: "s2", sellerName: "Martin Perez", saleTotal: 30000, commissionRate: 12, commissionAmount: 3600, bonusAmount: 500, totalPayout: 4100 },
      { id: "ll13", saleId: "sale-0240", sellerId: "s3", sellerName: "Sofia Alvarez", saleTotal: 28000, commissionRate: 10, commissionAmount: 2800, bonusAmount: 500, totalPayout: 3300 },
      { id: "ll14", saleId: "sale-0260", sellerId: "s4", sellerName: "Juan Torres", saleTotal: 22700, commissionRate: 10, commissionAmount: 2270, bonusAmount: 500, totalPayout: 2770 },
      { id: "ll15", saleId: "sale-0280", sellerId: "s5", sellerName: "Carla Ruiz", saleTotal: 18000, commissionRate: 10, commissionAmount: 1800, bonusAmount: 500, totalPayout: 2300 },
    ],
  },
]

// ── Audit Logs ──
export const auditLogs: AuditLog[] = [
  { id: "a1", timestamp: "2025-03-15T14:30:00Z", userId: "admin1", userName: "Admin", action: "create", entity: "Sale", entityId: "sale-0285", description: "Created sale sale-0285", before: null, after: { id: "sale-0285", total: 2400, sellerId: "s1" } },
  { id: "a2", timestamp: "2025-03-15T13:00:00Z", userId: "admin1", userName: "Admin", action: "update", entity: "Seller", entityId: "s6", description: "Updated seller Diego Herrera status to inactive", before: { status: "active" }, after: { status: "inactive" } },
  { id: "a3", timestamp: "2025-03-14T10:15:00Z", userId: "admin1", userName: "Admin", action: "finalize", entity: "Liquidation", entityId: "liq-002", description: "Finalized liquidation for February 2025", before: { status: "review" }, after: { status: "finalized" } },
  { id: "a4", timestamp: "2025-03-13T09:00:00Z", userId: "admin1", userName: "Admin", action: "create", entity: "CommissionPlan", entityId: "cp3", description: "Created Starter Plan", before: null, after: { id: "cp3", name: "Starter Plan", baseRate: 8 } },
  { id: "a5", timestamp: "2025-03-12T16:45:00Z", userId: "admin1", userName: "Admin", action: "update", entity: "Sale", entityId: "sale-0150", description: "Changed sale status to returned", before: { status: "completed" }, after: { status: "returned" } },
  { id: "a6", timestamp: "2025-03-12T11:30:00Z", userId: "admin1", userName: "Admin", action: "lock", entity: "Liquidation", entityId: "liq-001", description: "Locked liquidation for January 2025", before: { status: "finalized" }, after: { status: "locked" } },
  { id: "a7", timestamp: "2025-03-11T15:00:00Z", userId: "admin1", userName: "Admin", action: "create", entity: "Product", entityId: "p7", description: "Created Hardware Module A", before: null, after: { id: "p7", name: "Hardware Module A", price: 150 } },
  { id: "a8", timestamp: "2025-03-10T10:00:00Z", userId: "admin1", userName: "Admin", action: "update", entity: "CommissionPlan", entityId: "cp1", description: "Updated Standard Plan tier rates", before: { tiers: [{ rate: 8 }, { rate: 10 }, { rate: 12 }] }, after: { tiers: [{ rate: 10 }, { rate: 12 }, { rate: 15 }] } },
  { id: "a9", timestamp: "2025-03-09T14:20:00Z", userId: "admin1", userName: "Admin", action: "delete", entity: "Product", entityId: "p9", description: "Deleted deprecated product Widget X", before: { id: "p9", name: "Widget X" }, after: null },
  { id: "a10", timestamp: "2025-03-08T08:00:00Z", userId: "admin1", userName: "Admin", action: "create", entity: "Seller", entityId: "s8", description: "Created seller Roberto Silva", before: null, after: { id: "s8", name: "Roberto Silva", team: "Team Beta" } },
]
