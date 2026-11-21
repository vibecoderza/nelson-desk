// Settings: the client's company, their updates and their team.
import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalSettings } from "@/portal/settings.ts";
import { saveUpdates } from "@/portal/settings-actions.ts";
import { SettingsScreen } from "@/portal/settings-screens.tsx";
import { portalClientId, portalRole } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalSettings(quoteBook(), orderFile(), portalClientId(), portalRole() === "owner");
  if (!view) notFound();
  return (
    <PortalFrame current="settings" clientName={view.client_name}>
      <SettingsScreen view={view} said={readNotice(await searchParams)} save={saveUpdates} />
    </PortalFrame>
  );
}
