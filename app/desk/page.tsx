// Today. The proxy has already checked the staff list and the second factor before this renders.
import { sendFollowUp, reworkQuote } from "@/desk/actions.ts";
import { TodayScreen } from "@/desk/screens.tsx";
import { pipeline } from "@/desk/quotes.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";
import { DeskShell } from "@/ui/shell.tsx";

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const view = await pipeline(quoteBook(), "open", new Date());
  return (
    <DeskShell current="today" openQuotes={view.counts.open}>
      <TodayScreen view={view} said={readNotice(await searchParams)} actions={{ followUp: sendFollowUp, rework: reworkQuote }} />
    </DeskShell>
  );
}
