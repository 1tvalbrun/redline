import { AppSidebar } from "@/components/layout/AppSidebar"

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-[228px] p-8">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
