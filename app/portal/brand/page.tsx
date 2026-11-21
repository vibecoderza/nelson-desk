// Brand kit: what Nelson read from the client's brand guide or website, with the guesses left for them to confirm.
// With ?site= the page reads that website and shows what it found; nothing is saved by looking.
import { notFound } from "next/navigation";
import { fetchSite } from "@/brand/fetch-site.ts";
import { brandFile } from "@/brand/source.ts";
import { orderFile } from "@/orders/source.ts";
import { portalBrandKit, portalSiteKit } from "@/portal/brand.ts";
import { confirmKitItem, readWebsite } from "@/portal/brand-actions.ts";
import { BrandKitScreen } from "@/portal/brand-screens.tsx";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalHome } from "@/portal/orders.ts";
import { portalClientId, portalRole } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function BrandKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const home = await portalHome(quoteBook(), orderFile(), portalClientId(), new Date());
  if (!home) notFound();
  const site = typeof params.site === "string" ? await fetchSite(params.site) : null;
  const view = site?.ok ? portalSiteKit(site.host, site.read, site.logos, home.client_name) : await portalBrandKit(brandFile(), portalClientId(), home.client_name, portalRole() === "owner");
  const said = site && !site.ok ? { ok: false, text: site.code === "bad_address" ? "Type your website address, like yourbrand.co.za." : "That website could not be read. Check the address, or send Nelson your logo instead." } : readNotice(params);
  return (
    <PortalFrame current="brand" clientName={view.client_name}>
      <BrandKitScreen view={view} said={said} confirm={confirmKitItem} readSite={readWebsite} />
    </PortalFrame>
  );
}
