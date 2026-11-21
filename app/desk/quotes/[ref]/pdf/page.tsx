import { notFound } from "next/navigation";
import { DeskDocumentScreen } from "@/desk/screens.tsx";
import { quoteDocument } from "@/quotes/document.ts";
import { quoteBook } from "@/quotes/source.ts";
import { PrintButton } from "@/ui/print-button.tsx";
import { DeskFrame } from "@/desk/frame.tsx";

export default async function QuotePdfPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const book = quoteBook();
  const quote = await book.byRef((await params).ref);
  const wanted = Number((await searchParams).v);
  const doc = quote ? quoteDocument(quote, Number.isInteger(wanted) && wanted > 0 ? wanted : undefined) : null;
  if (!doc) notFound();
  return (
    <DeskFrame current="quotes">
      <DeskDocumentScreen doc={doc} printButton={<PrintButton label="Print or save as PDF" next />} />
    </DeskFrame>
  );
}
