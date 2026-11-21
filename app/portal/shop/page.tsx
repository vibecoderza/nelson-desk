// The mockup shop: the client's own pieces, picture first, each one quotable again.
import { notFound } from "next/navigation";
import { orderFile } from "@/orders/source.ts";
import { PortalFrame } from "@/portal/frame.tsx";
import { portalShop } from "@/portal/shop.ts";
import { orderAgain } from "@/portal/shop-actions.ts";
import { ShopScreen } from "@/portal/shop-screens.tsx";
import { portalClientId } from "@/portal/who.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = await portalShop(quoteBook(), orderFile(), portalClientId(), params.show === "ordered" ? "ordered" : "all");
  if (!view) notFound();
  return (
    <PortalFrame current="shop" clientName={view.client_name}>
      <ShopScreen view={view} said={readNotice(params)} again={orderAgain} />
    </PortalFrame>
  );
}
