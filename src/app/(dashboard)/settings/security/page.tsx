import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/permissions";
import { SecuritySessionsClient } from "@/components/settings/SecuritySessionsClient";

export default async function SecuritySettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Security & Sessions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage where you are signed in and control trusted devices.
        </p>
      </div>
      <SecuritySessionsClient />
    </div>
  );
}
