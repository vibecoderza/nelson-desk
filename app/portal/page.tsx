// Home. Quotes only for now: what needs the client, and a way in.
import { notFound } from "next/navigation";
import { reopenQuote } from "@/portal/actions.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalQuotes } from "@/portal/quotes.ts";
import { QuotesScreen } from "@/portal/screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalQuotes(quoteBook(), portalClientId(), "open", new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="home" clientName={view.client_name} openQuotes={view.counts.open}>
      <QuotesScreen view={view} said={readNotice(await searchParams)} reopen={reopenQuote} />
    </PortalFrame>
  );
}
