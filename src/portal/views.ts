// What the Portal may read. An allow-list: a table that is not here has no view, so the desk_portal role cannot
// reach it, and a column listed under `except` is left out of the view.
// Which member of staff did a thing is Nelson's business: every *_staff_id column is left out.
// The staff tables (quote_line_staff, quote_version_staff, order_line_staff) and everything about suppliers,
// costing, agents and the outbox are absent on purpose. Never add them.
export type PortalView = { except?: string[]; where?: string };

export const PORTAL_VIEWS: Record<string, PortalView> = {
  client: {},
  person: {},
  person_role: {},
  address: {},
  project: {},
  channel_identity: {},
  conversation: {},
  message: { except: ["author_agent_id", "author_staff_id"] },
  attachment: {},
  quote: {},
  quote_version: { except: ["sent_by_staff_id"], where: "sent_at is not null" }, // a draft version is Nelson's until it is sent
  quote_line: {},
  amendment: { except: ["answered_by_staff_id"] },
  decline: {},
  order: {},
  order_line: {},
  payment: { except: ["matched_by_staff_id"] },
  invoice_link: {},
  proof: { except: ["upload_token_hash", "approved_by_staff_id"] }, // the print house's upload link
  signature: {},
  shipment: {},
  shipment_event: {},
  hold: { except: ["placed_by_staff_id"] },
  brand_kit: {},
  brand_logo: {},
  brand_colour: {},
  brand_font: {},
  brand_rule: {},
  artwork_file: {},
  store_item: {},
  notification: { where: "party = 'client'" }, // not what the supplier or the print house was told
  preference: {},
  event: { where: "audience = 'both'" },
};

export const PORTAL_ROLE = "desk_portal";
export const PORTAL_SCHEMA = "portal";
