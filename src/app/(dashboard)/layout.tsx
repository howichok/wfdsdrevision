import { Navbar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen zenith-app-bg zenith-lines zenith-flow text-foreground antialiased flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto animate-fade-in">
        {children}
      </main>
    </div>
  );
}
