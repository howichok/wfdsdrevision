import { redirect } from "next/navigation";
import { requireSpecialAdmin } from "@/lib/auth/permissions";
import { AdminSessionsClient } from "@/components/admin/AdminSessionsClient";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  try {
    await requireSpecialAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Session Control Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide session and device oversight for the Special Admin.
        </p>
      </div>
      <AdminSessionsClient />
    </div>
  );
}
