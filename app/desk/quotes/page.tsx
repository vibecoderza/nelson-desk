import { sendFollowUp, reworkQuote } from "@/desk/actions.ts";
import { PipelineScreen } from "@/desk/screens.tsx";
import { pipeline, type PipelineTab } from "@/desk/quotes.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";
import { DeskShell } from "@/ui/shell.tsx";

const TABS: readonly PipelineTab[] = ["open", "accepted", "declined", "expired"];

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = TABS.find((t) => t === params.tab) ?? "open";
  const view = await pipeline(quoteBook(), tab, new Date());
  return (
    <DeskShell current="quotes" openQuotes={view.counts.open}>
      <PipelineScreen view={view} said={readNotice(params)} actions={{ followUp: sendFollowUp, rework: reworkQuote }} />
    </DeskShell>
  );
}
