import { notFound } from "next/navigation";
import { answerChange, replyToClient, sendVersion } from "@/desk/actions.ts";
import { nelsonStaffConfig } from "@/desk/mock-nelson-staff.ts";
import { BuilderScreen } from "@/desk/screens.tsx";
import { builder } from "@/desk/quotes.ts";
import { quoteBook } from "@/quotes/source.ts";
import { readNotice } from "@/ui/bits.tsx";
import { DeskFrame } from "@/desk/frame.tsx";

export default async function BuilderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const book = quoteBook();
  const view = await builder(book, nelsonStaffConfig(), (await params).ref, new Date());
  if (!view) notFound();
  return (
    <DeskFrame current="quotes">
      <BuilderScreen view={view} said={readNotice(await searchParams)} actions={{ answer: answerChange, send: sendVersion, reply: replyToClient }} />
    </DeskFrame>
  );
}
