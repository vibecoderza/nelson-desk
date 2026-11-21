import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { askForProofChange, signProof } from "@/portal/order-actions.ts";
import { portalProof } from "@/portal/orders.ts";
import { ProofScreen } from "@/portal/order-screens.tsx";
import { portalClientId, portalRole } from "@/portal/who.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function ProofPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalProof(orderFile(), portalClientId(), (await params).ref, portalRole(), new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="orders" clientName={view.client_name}>
      <ProofScreen view={view} said={readNotice(await searchParams)} sign={signProof} askChange={askForProofChange} />
    </PortalFrame>
  );
}
