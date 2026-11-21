import { notFound } from "next/navigation";
import { reworkQuote, sendFollowUp } from "@/desk/actions.ts";
import { clientPage } from "@/desk/clients.ts";
import { ClientScreen } from "@/desk/client-screens.tsx";
import { DeskFrame } from "@/desk/frame.tsx";
import { placeSupplierOrder } from "@/desk/order-actions.ts";
import { orderFile } from "@/orders/source.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await clientPage(quoteBook(), orderFile(), (await params).id, new Date());
  if (!view) notFound();
  return (
    <DeskFrame current="clients">
      <ClientScreen view={view} said={readNotice(await searchParams)} actions={{ followUp: sendFollowUp, rework: reworkQuote, place: placeSupplierOrder }} />
    </DeskFrame>
  );
}
