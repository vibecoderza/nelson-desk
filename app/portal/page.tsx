// Home: what needs the client, and what is on its way.
import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalHome } from "@/portal/orders.ts";
import { HomeScreen } from "@/portal/order-screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await portalHome(quoteBook(), orderFile(), portalClientId(), new Date());
  if (!view) notFound();
  return (
    <PortalFrame current="home" clientName={view.client_name}>
      <HomeScreen view={view} said={readNotice(await searchParams)} />
    </PortalFrame>
  );
}
