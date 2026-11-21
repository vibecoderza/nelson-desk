import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { askOnOrder } from "@/portal/order-actions.ts";
import { portalOrder } from "@/portal/orders.ts";
import { OrderScreen } from "@/portal/order-screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalOrder(orderFile(), portalClientId(), (await params).ref, new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="orders" clientName={view.client_name}>
      <OrderScreen view={view} said={readNotice(await searchParams)} ask={askOnOrder} />
    </PortalFrame>
  );
}
