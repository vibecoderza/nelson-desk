// Where the order screens read from. Today that is the stand-in file; the database reader takes its place in the
// card that brings Neon in, behind the same three calls.
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";
import { mockOrders } from "../mock/orders.ts";
import type { OrderFile } from "./book.ts";

export function orderFile(): OrderFile {
  if (mockBookInUse()) return mockOrders();
  throw new NotBuiltYet("The database order file");
}
