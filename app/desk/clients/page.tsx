import { clients } from "@/desk/clients.ts";
import { ClientsScreen } from "@/desk/client-screens.tsx";
import { DeskFrame } from "@/desk/frame.tsx";
import { orderFile } from "@/orders/source.ts";
import { quoteBook } from "@/quotes/source.ts";

export default async function ClientsPage() {
  return (
    <DeskFrame current="clients">
      <ClientsScreen view={await clients(quoteBook(), orderFile())} />
    </DeskFrame>
  );
}
