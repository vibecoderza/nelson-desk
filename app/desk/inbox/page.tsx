import { DeskFrame } from "@/desk/frame.tsx";
import { startQuote } from "@/desk/inbox-actions.ts";
import { InboxScreen } from "@/desk/inbox-screens.tsx";
import { inbox } from "@/desk/inbox.ts";
import { orderFile } from "@/orders/source.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <DeskFrame current="inbox">
      <InboxScreen view={await inbox(quoteBook(), orderFile(), new Date())} said={readNotice(await searchParams)} start={startQuote} />
    </DeskFrame>
  );
}
