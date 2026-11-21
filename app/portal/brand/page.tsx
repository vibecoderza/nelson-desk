// Brand kit: what Nelson read from the client's brand guide, with the guesses left for them to confirm.
import { notFound } from "next/navigation";
import { brandFile } from "@/brand/source.ts";
import { orderFile } from "@/orders/source.ts";
import { portalBrandKit } from "@/portal/brand.ts";
import { confirmKitItem } from "@/portal/brand-actions.ts";
import { BrandKitScreen } from "@/portal/brand-screens.tsx";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalHome } from "@/portal/orders.ts";
import { portalClientId, portalRole } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function BrandKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const home = await portalHome(quoteBook(), orderFile(), portalClientId(), new Date());
  if (!home) notFound();
  const view = await portalBrandKit(brandFile(), portalClientId(), home.client_name, portalRole() === "owner");
  return (
    <PortalFrame current="brand" clientName={view.client_name}>
      <BrandKitScreen view={view} said={readNotice(await searchParams)} confirm={confirmKitItem} />
    </PortalFrame>
  );
}
