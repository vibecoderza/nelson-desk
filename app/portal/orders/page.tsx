import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalOrders } from "@/portal/orders.ts";
import { OrdersScreen } from "@/portal/order-screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = await portalOrders(orderFile(), portalClientId(), params.tab === "done" ? "done" : "open", new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="orders" clientName={view.client_name}>
      <OrdersScreen view={view} said={readNotice(params)} />
    </PortalFrame>
  );
}
