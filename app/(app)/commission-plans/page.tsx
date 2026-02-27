import { AppTopbar } from "@/components/app-topbar"
import { getCommissionPlans } from "@/lib/repos/commission-plans-repo"
import CommissionPlansContent from "./CommissionPlansContent"

export default async function CommissionPlansPage() {
  const plans = await getCommissionPlans()
  return (
    <>
      <AppTopbar title="Planes de comisión" />
      <CommissionPlansContent plansIniciales={plans} />
    </>
  )
}