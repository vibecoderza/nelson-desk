// The Portal's frame, with the one line that says the quotes are samples while the Portal runs on mock data.
import type { ReactNode } from "react";
import { mockBookInUse } from "../mock/mode.ts";
import { QUOTE_SETTINGS } from "../quotes/settings.ts";
import { PortalShell } from "../ui/shell.tsx";
import { PortalMockBar } from "./screens.tsx";

export function PortalFrame({ current, clientName, openQuotes, children }: { current: "home" | "quotes"; clientName: string; openQuotes: number; children: ReactNode }) {
  return (
    <PortalShell current={current} clientName={clientName} openQuotes={openQuotes} contact={QUOTE_SETTINGS.staffContact}>
      {mockBookInUse() && <div className="page no-print" style={{ marginBottom: 16 }}><PortalMockBar /></div>}
      {children}
    </PortalShell>
  );
}
