// The supply side of an order. Desk only: who makes it and under which of their order numbers. It never leaves this
// folder. On mock data these are sample facts; with the database they are order_line_staff rows.
export type Supply = { supplier: string; supplier_order_ref: string | null; placed: boolean };

const SAMPLE: Record<string, Supply> = {
  "N-1038": { supplier: "Amrod", supplier_order_ref: null, placed: false },
  "N-1036": { supplier: "Headwear 24", supplier_order_ref: null, placed: false },
  "N-1035": { supplier: "Amrod", supplier_order_ref: null, placed: false },
  "N-1033": { supplier: "Barron", supplier_order_ref: null, placed: false },
  "N-1031": { supplier: "Amrod", supplier_order_ref: "SO-88214", placed: true },
  "N-1030": { supplier: "Amrod", supplier_order_ref: "SO-88301", placed: true },
  "N-1028": { supplier: "Amrod", supplier_order_ref: "SO-88102", placed: true },
  "N-1019": { supplier: "Amrod", supplier_order_ref: "SO-87410", placed: true },
};
export const supplyFor = (ref: string): Supply | null => SAMPLE[ref] ?? null;
