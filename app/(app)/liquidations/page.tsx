import { AppTopbar } from "@/components/app-topbar"
import { getLiquidations } from "@/lib/repos/liquidations-repo"
import { getSellers } from "@/lib/repos/sellers-repo"
import LiquidationsContent from "./LiquidationsContent"

export default async function LiquidationsPage() {
  const [liquidations, sellers] = await Promise.all([getLiquidations(), getSellers()])

  return (
    <>
      <AppTopbar title="Liquidaciones" />
      <LiquidationsContent liquidationsIniciales={liquidations} sellers={sellers} />
    </>
  )
}