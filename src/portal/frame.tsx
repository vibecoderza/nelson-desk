// The Portal's frame, with the one line that says the data is a sample while the Portal runs on mock data.
import type { ReactNode } from "react";
import { mockBookInUse } from "../mock/mode.ts";
import { orderFile } from "../orders/source.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { quoteBook } from "../quotes/source.ts";
import { PortalShell, type PortalPlace } from "../ui/shell.tsx";
import { portalCounts } from "./orders.ts";
import { PortalMockBar } from "./screens.tsx";
import { portalClientId } from "./who.ts";

export async function PortalFrame({ current, clientName, children }: { current: PortalPlace; clientName: string; children: ReactNode }) {
  const counts = await portalCounts(quoteBook(), orderFile(), portalClientId());
  return (
    <PortalShell current={current} clientName={clientName} openQuotes={counts.quotes} openOrders={counts.orders} contact={QUOTE_SETTINGS.staffContact}>
      {mockBookInUse() && <div className="page no-print" style={{ marginBottom: 16 }}><PortalMockBar /></div>}
      {children}
    </PortalShell>
  );
}
