
import { getProducts } from "@/lib/repos/products-repo"
import ProductsContent from "./ProductsContent"
import { AppTopbar } from "@/components/app-topbar"

export default async function ProductsPage() {
  const products = await getProducts()
    return (
    <>
      <AppTopbar title="Productos" />
      <ProductsContent productsIniciales={products} />
    </>
  )
}