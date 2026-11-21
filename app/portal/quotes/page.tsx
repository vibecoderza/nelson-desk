import { notFound } from "next/navigation";
import { reopenQuote } from "@/portal/actions.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalQuotes, type PortalTab } from "@/portal/quotes.ts";
import { QuotesScreen } from "@/portal/screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

const TABS: readonly PortalTab[] = ["open", "accepted", "closed"];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = await portalQuotes(quoteBook(), portalClientId(), TABS.find((t) => t === params.tab) ?? "open", new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="quotes" clientName={view.client_name}>
      <QuotesScreen view={view} said={readNotice(params)} reopen={reopenQuote} />
    </PortalFrame>
  );
}
