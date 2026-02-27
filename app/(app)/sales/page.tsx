// app/(app)/sales/page.tsx
import { AppTopbar } from "@/components/app-topbar"
import { getProducts } from "@/lib/repos/products-repo"
import { getSales } from "@/lib/repos/sales-repo"
import { getSellers } from "@/lib/repos/sellers-repo"
import { getActiveCommissionPlans } from "@/lib/repos/commission-plans-repo"
import SalesContent from "./SalesContent"

export default async function SalesPage() {
  const [sales, products, sellers, commissionPlans] = await Promise.all([
    getSales(),
    getProducts(),
    getSellers(),
    getActiveCommissionPlans(),
  ])

  return (
    <>
      <AppTopbar title="Ventas" />
      <SalesContent
        salesIniciales={sales}
        products={products}
        sellers={sellers}
        commissionPlans={commissionPlans}
      />
    </>
  )
}