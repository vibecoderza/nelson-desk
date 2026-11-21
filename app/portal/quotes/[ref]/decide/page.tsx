import { notFound } from "next/navigation";
import { acceptQuote, declineQuote } from "@/portal/actions.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalDecide } from "@/portal/quotes.ts";
import { DecideScreen } from "@/portal/screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function DecidePage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalDecide(quoteBook(), portalClientId(), (await params).ref);
  if (!view) notFound();
  return (
    <PortalFrame current="quotes" clientName={view.client_name}>
      <DecideScreen view={view} said={readNotice(await searchParams)} accept={acceptQuote} decline={declineQuote} />
    </PortalFrame>
  );
}
