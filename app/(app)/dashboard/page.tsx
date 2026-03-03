// app/dashboard/page.tsx
import { AppTopbar } from "@/components/app-topbar"
import { DashboardContents } from "@/components/dashboard/dashboard-contents"
import { getDashboardData } from "@/lib/repos/dashboard-repo"

export default async function DashboardPage() {
  const initial = await getDashboardData({ period: "this-quarter", seller: "all" })

  return (
    <>
      <AppTopbar title="Dashboard" />
      <DashboardContents initialData={initial} />
    </>
  )
}