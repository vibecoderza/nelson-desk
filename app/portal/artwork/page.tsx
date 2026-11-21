// Artwork: the client's files with their check result, and the redraws Nelson made.
import { notFound } from "next/navigation";
import { brandFile } from "@/brand/source.ts";
import { orderFile } from "@/orders/source.ts";
import { artworkFilter, portalArtwork } from "@/portal/brand.ts";
import { askForRedraw, makeMainLogo } from "@/portal/brand-actions.ts";
import { ArtworkScreen } from "@/portal/brand-screens.tsx";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalHome } from "@/portal/orders.ts";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function ArtworkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const home = await portalHome(quoteBook(), orderFile(), portalClientId(), new Date());
  if (!home) notFound();
  const view = await portalArtwork(brandFile(), portalClientId(), home.client_name, artworkFilter(params.tag));
  return (
    <PortalFrame current="artwork" clientName={view.client_name}>
      <ArtworkScreen view={view} said={readNotice(params)} redraw={askForRedraw} makeMain={makeMainLogo} />
    </PortalFrame>
  );
}
