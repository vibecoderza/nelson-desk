// The Desk's frame: the rail, with the open counts beside each section.
import type { ReactNode } from "react";
import { isDone } from "../orders/book.ts";
import { orderFile } from "../orders/source.ts";
import { quoteBook } from "../quotes/source.ts";
import { DeskShell, type DeskPlace } from "../ui/shell.tsx";
import { openQuoteCount } from "./quotes.ts";

export async function DeskFrame({ current, children }: { current: DeskPlace; children: ReactNode }) {
  const [quotes, orders] = await Promise.all([openQuoteCount(quoteBook()), orderFile().all()]);
  return <DeskShell current={current} openQuotes={quotes} openOrders={orders.filter((o) => !isDone(o)).length}>{children}</DeskShell>;
}
