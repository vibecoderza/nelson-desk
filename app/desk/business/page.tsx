import { BusinessScreen } from "@/desk/back-office-screens.tsx";
import { business } from "@/desk/business.ts";
import { DeskFrame } from "@/desk/frame.tsx";
import { orderFile } from "@/orders/source.ts";
import { quoteBook } from "@/quotes/source.ts";

export default async function BusinessPage() {
  return <DeskFrame current="business"><BusinessScreen view={await business(quoteBook(), orderFile(), new Date())} /></DeskFrame>;
}
