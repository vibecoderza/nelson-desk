import { SuppliersScreen } from "@/desk/back-office-screens.tsx";
import { DeskFrame } from "@/desk/frame.tsx";
import { suppliers } from "@/desk/suppliers.ts";
import { orderFile } from "@/orders/source.ts";

export default async function SuppliersPage() {
  return <DeskFrame current="suppliers"><SuppliersScreen view={await suppliers(orderFile(), new Date())} /></DeskFrame>;
}
