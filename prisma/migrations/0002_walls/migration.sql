-- Written by scripts/build-walls.ts from src/portal/views.ts. Do not edit by hand.
-- The second wall behind the hostname split (brief 7.4): Portal code connects as a member of desk_portal,
-- which can read these views and nothing else.

CREATE SCHEMA IF NOT EXISTS "portal";
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'desk_portal') THEN CREATE ROLE desk_portal NOLOGIN; END IF; END $$;
REVOKE ALL ON SCHEMA public FROM desk_portal;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM desk_portal;
GRANT USAGE ON SCHEMA "portal" TO desk_portal;

CREATE VIEW "portal"."client" AS SELECT "id", "name", "status", "clerk_org_id", "email_domain", "shopify_customer_id", "reorder_window_days", "auto_mockups_paused", "created_at", "updated_at" FROM public."client";
GRANT SELECT ON "portal"."client" TO desk_portal;
CREATE VIEW "portal"."person" AS SELECT "id", "client_id", "name", "email", "clerk_user_id", "created_at", "updated_at" FROM public."person";
GRANT SELECT ON "portal"."person" TO desk_portal;
CREATE VIEW "portal"."person_role" AS SELECT "id", "person_id", "role", "spend_limit_cents", "created_at", "updated_at" FROM public."person_role";
GRANT SELECT ON "portal"."person_role" TO desk_portal;
CREATE VIEW "portal"."address" AS SELECT "id", "client_id", "label", "line1", "line2", "suburb", "city", "province", "postal_code", "country", "receiving_contact", "receiving_phone", "created_at", "updated_at" FROM public."address";
GRANT SELECT ON "portal"."address" TO desk_portal;
CREATE VIEW "portal"."project" AS SELECT "id", "client_id", "name", "budget_cents", "created_at", "updated_at" FROM public."project";
GRANT SELECT ON "portal"."project" TO desk_portal;
CREATE VIEW "portal"."channel_identity" AS SELECT "id", "person_id", "client_id", "channel", "address", "verified_at", "opt_in_wording", "opt_in_at", "created_at", "updated_at" FROM public."channel_identity";
GRANT SELECT ON "portal"."channel_identity" TO desk_portal;
CREATE VIEW "portal"."conversation" AS SELECT "id", "client_id", "quote_id", "channel", "subject", "last_message_at", "created_at", "updated_at" FROM public."conversation";
GRANT SELECT ON "portal"."conversation" TO desk_portal;
CREATE VIEW "portal"."message" AS SELECT "id", "conversation_id", "direction", "author_person_id", "body", "external_id", "sent_at", "created_at", "updated_at" FROM public."message";
GRANT SELECT ON "portal"."message" TO desk_portal;
CREATE VIEW "portal"."attachment" AS SELECT "id", "message_id", "blob_key", "filename", "content_type", "bytes", "created_at", "updated_at" FROM public."attachment";
GRANT SELECT ON "portal"."attachment" TO desk_portal;
CREATE VIEW "portal"."quote" AS SELECT "id", "ref", "client_id", "project_id", "title", "state", "version", "valid_until", "first_sent_at", "last_sent_at", "seen_opened_at", "seen_video_at", "created_at", "updated_at" FROM public."quote";
GRANT SELECT ON "portal"."quote" TO desk_portal;
CREATE VIEW "portal"."quote_version" AS SELECT "id", "quote_id", "version", "sent_at", "snapshot", "price_customer", "price_version", "total_cents", "change_log", "pdf_key", "mockup_keys", "created_at", "updated_at" FROM public."quote_version" WHERE sent_at is not null;
GRANT SELECT ON "portal"."quote_version" TO desk_portal;
CREATE VIEW "portal"."quote_line" AS SELECT "id", "quote_id", "position", "product_code", "product_name", "colour", "quantity", "design_ref", "design_rev", "decoration", "state", "price_status", "unit_cents", "setup_cents", "line_total_cents", "price_version", "manual_price_by", "manual_price_reason", "due_date", "removed_at", "created_at", "updated_at" FROM public."quote_line";
GRANT SELECT ON "portal"."quote_line" TO desk_portal;
CREATE VIEW "portal"."amendment" AS SELECT "id", "quote_line_id", "state", "kind", "design_ref", "design_rev", "requested", "design_check", "suggestion", "decline_reason", "requested_by_person_id", "answered_at", "created_at", "updated_at" FROM public."amendment";
GRANT SELECT ON "portal"."amendment" TO desk_portal;
CREATE VIEW "portal"."decline" AS SELECT "id", "quote_id", "version", "reason", "budget_cents", "note", "person_id", "created_at", "updated_at" FROM public."decline";
GRANT SELECT ON "portal"."decline" TO desk_portal;
CREATE VIEW "portal"."order" AS SELECT "id", "ref", "client_id", "source", "quote_id", "quote_version", "nelson_order_ref", "shop_order_name", "state", "on_hold", "pack_status", "total_cents", "target_date", "signed_at", "ship_to", "created_at", "updated_at" FROM public."order";
GRANT SELECT ON "portal"."order" TO desk_portal;
CREATE VIEW "portal"."order_line" AS SELECT "id", "order_id", "position", "product_code", "product_name", "colour", "quantity", "design_ref", "design_rev", "unit_cents", "setup_cents", "line_total_cents", "created_at", "updated_at" FROM public."order_line";
GRANT SELECT ON "portal"."order_line" TO desk_portal;
CREATE VIEW "portal"."payment" AS SELECT "id", "order_id", "quote_id", "method", "kind", "amount_cents", "reference", "state", "received_at", "created_at", "updated_at" FROM public."payment";
GRANT SELECT ON "portal"."payment" TO desk_portal;
CREATE VIEW "portal"."invoice_link" AS SELECT "id", "order_id", "xero_invoice_id", "xero_number", "state", "amount_cents", "due_on", "created_at", "updated_at" FROM public."invoice_link";
GRANT SELECT ON "portal"."invoice_link" TO desk_portal;
CREATE VIEW "portal"."proof" AS SELECT "id", "ref", "order_id", "state", "round", "sheet_key", "sheet_sha256", "with_client_at", "change_note", "created_at", "updated_at" FROM public."proof";
GRANT SELECT ON "portal"."proof" TO desk_portal;
CREATE VIEW "portal"."signature" AS SELECT "id", "proof_id", "round", "person_id", "name", "signature", "signed_at", "ip", "user_agent", "words_shown", "checks", "sheet_sha256", "record_sha256", "created_at", "updated_at" FROM public."signature";
GRANT SELECT ON "portal"."signature" TO desk_portal;
CREATE VIEW "portal"."shipment" AS SELECT "id", "order_id", "courier", "service", "waybill", "cartons", "tracking_url", "dispatched_at", "delivered_at", "created_at", "updated_at" FROM public."shipment";
GRANT SELECT ON "portal"."shipment" TO desk_portal;
CREATE VIEW "portal"."shipment_event" AS SELECT "id", "shipment_id", "status", "description", "occurred_at", "created_at", "updated_at" FROM public."shipment_event";
GRANT SELECT ON "portal"."shipment_event" TO desk_portal;
CREATE VIEW "portal"."hold" AS SELECT "id", "order_id", "reason", "released_at", "created_at", "updated_at" FROM public."hold";
GRANT SELECT ON "portal"."hold" TO desk_portal;
CREATE VIEW "portal"."brand_kit" AS SELECT "id", "client_id", "source_kind", "status", "created_at", "updated_at" FROM public."brand_kit";
GRANT SELECT ON "portal"."brand_kit" TO desk_portal;
CREATE VIEW "portal"."brand_logo" AS SELECT "id", "brand_kit_id", "name", "kind", "blob_key", "confirmed", "created_at", "updated_at" FROM public."brand_logo";
GRANT SELECT ON "portal"."brand_logo" TO desk_portal;
CREATE VIEW "portal"."brand_colour" AS SELECT "id", "brand_kit_id", "name", "hex", "nearest_thread", "confirmed", "created_at", "updated_at" FROM public."brand_colour";
GRANT SELECT ON "portal"."brand_colour" TO desk_portal;
CREATE VIEW "portal"."brand_font" AS SELECT "id", "brand_kit_id", "family", "use", "confirmed", "created_at", "updated_at" FROM public."brand_font";
GRANT SELECT ON "portal"."brand_font" TO desk_portal;
CREATE VIEW "portal"."brand_rule" AS SELECT "id", "brand_kit_id", "text", "confirmed", "created_at", "updated_at" FROM public."brand_rule";
GRANT SELECT ON "portal"."brand_rule" TO desk_portal;
CREATE VIEW "portal"."artwork_file" AS SELECT "id", "client_id", "blob_key", "filename", "origin", "check_result", "needs_redraw", "created_at", "updated_at" FROM public."artwork_file";
GRANT SELECT ON "portal"."artwork_file" TO desk_portal;
CREATE VIEW "portal"."store_item" AS SELECT "id", "client_id", "kind", "product_code", "design_ref", "design_rev", "mockup_key", "guide_unit_cents", "guide_quantity", "created_at", "updated_at" FROM public."store_item";
GRANT SELECT ON "portal"."store_item" TO desk_portal;
CREATE VIEW "portal"."notification" AS SELECT "id", "event_id", "person_id", "party", "channel", "template_key", "status", "external_id", "sent_at", "read_at", "created_at", "updated_at" FROM public."notification" WHERE party = 'client';
GRANT SELECT ON "portal"."notification" TO desk_portal;
CREATE VIEW "portal"."preference" AS SELECT "id", "person_id", "kind", "channel", "enabled", "created_at", "updated_at" FROM public."preference";
GRANT SELECT ON "portal"."preference" TO desk_portal;
CREATE VIEW "portal"."event" AS SELECT "id", "type", "subject_type", "subject_id", "client_id", "audience", "data", "actor", "actor_id", "occurred_at", "due_at", "resolved_at", "created_at", "updated_at" FROM public."event" WHERE audience = 'both';
GRANT SELECT ON "portal"."event" TO desk_portal;

-- A quote version is immutable once sent (brief 3.2): its lines, prices, mockups, terms and total are frozen.
-- Only the document keys made from it (the PDF, the mockup snapshot) may be filled in afterwards.
CREATE FUNCTION quote_version_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sent_at IS NOT NULL THEN RAISE EXCEPTION 'quote version % v% is sent and cannot be deleted', OLD.quote_id, OLD.version; END IF;
    RETURN OLD;
  END IF;
  IF OLD.sent_at IS NOT NULL AND (
    NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.version IS DISTINCT FROM OLD.version OR
    NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.price_customer IS DISTINCT FROM OLD.price_customer OR
    NEW.price_version IS DISTINCT FROM OLD.price_version OR NEW.total_cents IS DISTINCT FROM OLD.total_cents OR
    NEW.change_log IS DISTINCT FROM OLD.change_log
  ) THEN RAISE EXCEPTION 'quote version % v% is sent and frozen', OLD.quote_id, OLD.version; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quote_version_frozen BEFORE UPDATE OR DELETE ON quote_version FOR EACH ROW EXECUTE FUNCTION quote_version_frozen();

-- The event log is the record every screen reads. Rows are never deleted.
CREATE FUNCTION event_never_deleted() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'events are never deleted'; END $$;
CREATE TRIGGER event_never_deleted BEFORE DELETE ON event FOR EACH ROW EXECUTE FUNCTION event_never_deleted();
