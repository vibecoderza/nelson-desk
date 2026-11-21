import { notFound } from "next/navigation";
import { askForPick, askOnQuote, takeSuggestion } from "@/portal/actions.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { parsePick, portalQuote } from "@/portal/quotes.ts";
import { QuoteScreen } from "@/portal/screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const wanted = Number(query.v);
  const view = await portalQuote(quoteBook(), portalClientId(), (await params).ref, Number.isInteger(wanted) && wanted > 0 ? wanted : undefined, new Date(), parsePick(typeof query.pick === "string" ? query.pick : undefined));
  if (!view) notFound();
  return (
    <PortalFrame current="quotes" clientName={view.client_name}>
      <QuoteScreen view={view} said={readNotice(query)} takeSuggestion={takeSuggestion} ask={askOnQuote} askForPick={askForPick} />
    </PortalFrame>
  );
}
