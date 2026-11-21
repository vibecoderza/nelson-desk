import { DeskFrame } from "@/desk/frame.tsx";
import { placeSupplierOrder } from "@/desk/order-actions.ts";
import { BoardScreen } from "@/desk/order-screens.tsx";
import { board } from "@/desk/orders.ts";
import { orderFile } from "@/orders/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = await board(orderFile(), params.tab === "done" ? "done" : "open", new Date());
  return (
    <DeskFrame current="orders">
      <BoardScreen view={view} said={readNotice(params)} place={placeSupplierOrder} />
    </DeskFrame>
  );
}
