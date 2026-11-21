// Today. The proxy has already checked the staff list and the second factor before this renders.
import { sendFollowUp, reworkQuote } from "@/desk/actions.ts";
import { DeskFrame } from "@/desk/frame.tsx";
import { placeSupplierOrder } from "@/desk/order-actions.ts";
import { board } from "@/desk/orders.ts";
import { TodayScreen } from "@/desk/screens.tsx";
import { pipeline } from "@/desk/quotes.ts";
import { orderFile } from "@/orders/source.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const now = new Date();
  const [view, orders] = await Promise.all([pipeline(quoteBook(), "open", now), board(orderFile(), "open", now)]);
  return (
    <DeskFrame current="today">
      <TodayScreen view={view} orders={orders} said={readNotice(await searchParams)} actions={{ followUp: sendFollowUp, rework: reworkQuote, place: placeSupplierOrder }} />
    </DeskFrame>
  );
}
