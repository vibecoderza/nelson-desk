import { notFound } from "next/navigation";
import { PortalFrame } from "@/portal/frame.tsx";
import { DocumentScreen } from "@/portal/screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteDocument } from "@/quotes/document.ts";
import { quoteBook } from "@/quotes/source.ts";
import { PrintButton } from "@/ui/print-button.tsx";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const clientId = portalClientId();
  const book = quoteBook();
  const quote = await book.byRef((await params).ref);
  const wanted = Number((await searchParams).v);
  // Someone else's quote and a draft look the same as no quote at all.
  const doc = quote && quote.client.id === clientId && quote.state !== "draft" ? quoteDocument(quote, Number.isInteger(wanted) && wanted > 0 ? wanted : undefined) : null;
  if (!doc) notFound();
  return (
    <PortalFrame current="quotes" clientName={doc.for.company}>
      <DocumentScreen doc={doc} printButton={<PrintButton label="Print or save as PDF" next />} />
    </PortalFrame>
  );
}
