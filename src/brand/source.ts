// Where the brand screens read from. The stand-in file today; the database reader takes its place with Neon.
import { mockBrand } from "../mock/brand.ts";
import { mockBookInUse, NotBuiltYet } from "../mock/mode.ts";
import type { BrandFile } from "./file.ts";

export function brandFile(): BrandFile {
  if (mockBookInUse()) return mockBrand();
  throw new NotBuiltYet("The database brand file");
}
