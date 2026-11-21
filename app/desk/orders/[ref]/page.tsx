import { notFound } from "next/navigation";
import { DeskFrame } from "@/desk/frame.tsx";
import { approveProof, holdOrder, markDelivered, placeSupplierOrder, releaseOrder, saveWaybill, sendProofBack } from "@/desk/order-actions.ts";
import { DeskOrderScreen } from "@/desk/order-screens.tsx";
import { deskOrder } from "@/desk/orders.ts";
import { orderFile } from "@/orders/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await deskOrder(orderFile(), (await params).ref, new Date());
  if (!view) notFound();
  return (
    <DeskFrame current="orders">
      <DeskOrderScreen view={view} said={readNotice(await searchParams)} actions={{ approve: approveProof, sendBack: sendProofBack, place: placeSupplierOrder, waybill: saveWaybill, delivered: markDelivered, hold: holdOrder, release: releaseOrder }} />
    </DeskFrame>
  );
}
