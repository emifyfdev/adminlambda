import { AppTopbar } from "@/components/app-topbar"
import { getSellers } from "@/lib/repos/sellers-repo"
import SellersContent from "./SellersContent"

export default async function SellersPage() {
  const sellers = await getSellers()

  return (
    <>
      <AppTopbar title="Vendedores" />
      <SellersContent sellersIniciales={sellers} />
    </>
  )
}