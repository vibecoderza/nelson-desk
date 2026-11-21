-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteState" AS ENUM ('draft', 'working', 'final', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "LineState" AS ENUM ('agreed', 'waiting_on_nelson', 'nelson_suggests', 'waiting_on_supplier');

-- CreateEnum
CREATE TYPE "AmendmentState" AS ENUM ('waiting', 'accepted', 'suggested', 'declined', 'superseded');

-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('paid', 'proof_with_nelson', 'proof_with_client', 'signed', 'in_production', 'dispatched', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "ProofState" AS ENUM ('awaiting_sheet', 'with_nelson', 'with_client', 'signed');

-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('owner', 'buyer', 'viewer');

-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('staff', 'both');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'done', 'failed');

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "clerk_org_id" TEXT,
    "email_domain" TEXT,
    "shopify_customer_id" TEXT,
    "reorder_window_days" INTEGER,
    "auto_mockups_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "clerk_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_role" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role" "ClientRole" NOT NULL,
    "spend_limit_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "suburb" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'ZA',
    "receiving_contact" TEXT,
    "receiving_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_source" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "first_touch" TEXT NOT NULL,
    "posthog_distinct_id" TEXT,
    "consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_note" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "author_staff_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_identity" (
    "id" TEXT NOT NULL,
    "person_id" TEXT,
    "client_id" TEXT,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "opt_in_wording" TEXT,
    "opt_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "quote_id" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "author_person_id" TEXT,
    "author_staff_id" TEXT,
    "author_agent_id" TEXT,
    "body" TEXT NOT NULL,
    "external_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "blob_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "conversation_id" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "quote_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brief" (
    "id" TEXT NOT NULL,
    "enquiry_id" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT,
    "state" "QuoteState" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMP(3),
    "first_sent_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "seen_opened_at" TIMESTAMP(3),
    "seen_video_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_version" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "price_customer" JSONB NOT NULL,
    "price_version" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "change_log" JSONB NOT NULL DEFAULT '[]',
    "pdf_key" TEXT,
    "mockup_keys" JSONB NOT NULL DEFAULT '[]',
    "sent_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_version_staff" (
    "id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "price_staff" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_version_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "design_ref" TEXT,
    "design_rev" INTEGER,
    "decoration" JSONB NOT NULL DEFAULT '[]',
    "state" "LineState" NOT NULL DEFAULT 'agreed',
    "price_status" TEXT NOT NULL DEFAULT 'priced',
    "unit_cents" INTEGER,
    "setup_cents" INTEGER,
    "line_total_cents" INTEGER,
    "price_version" TEXT,
    "manual_price_by" TEXT,
    "manual_price_reason" TEXT,
    "due_date" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_staff" (
    "id" TEXT NOT NULL,
    "quote_line_id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "stock" INTEGER,
    "incoming_stock" JSONB NOT NULL DEFAULT '[]',
    "unit_cost_cents" INTEGER,
    "branding_cost_cents" INTEGER,
    "markup_applied_pct" DOUBLE PRECISION,
    "margin_cents" INTEGER,
    "margin_pct" DOUBLE PRECISION,
    "stock_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amendment" (
    "id" TEXT NOT NULL,
    "quote_line_id" TEXT NOT NULL,
    "state" "AmendmentState" NOT NULL DEFAULT 'waiting',
    "kind" TEXT NOT NULL,
    "design_ref" TEXT,
    "design_rev" INTEGER,
    "requested" JSONB NOT NULL,
    "design_check" JSONB,
    "suggestion" TEXT,
    "decline_reason" TEXT,
    "requested_by_person_id" TEXT,
    "answered_by_staff_id" TEXT,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "due_on" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decline" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "budget_cents" INTEGER,
    "note" TEXT,
    "person_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT,
    "answer_window_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costing_request" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "quote_line_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'out',
    "pack" JSONB NOT NULL,
    "reply_token_hash" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "answer_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "costing_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costing_answer" (
    "id" TEXT NOT NULL,
    "costing_request_id" TEXT NOT NULL,
    "breaks" JSONB NOT NULL,
    "setup_cost_cents" INTEGER,
    "answered_at" TIMESTAMP(3) NOT NULL,
    "entered_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "costing_answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "quote_id" TEXT,
    "quote_version" INTEGER,
    "nelson_order_ref" TEXT NOT NULL,
    "shop_order_name" TEXT,
    "state" "OrderState" NOT NULL DEFAULT 'paid',
    "on_hold" BOOLEAN NOT NULL DEFAULT false,
    "pack_status" TEXT,
    "total_cents" INTEGER NOT NULL,
    "target_date" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "ship_to" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "design_ref" TEXT NOT NULL,
    "design_rev" INTEGER NOT NULL,
    "unit_cents" INTEGER NOT NULL,
    "setup_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_staff" (
    "id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "supplier_ref" TEXT,
    "pack_id" TEXT,
    "unit_cost_cents" INTEGER,
    "branding_cost_cents" INTEGER,
    "freight_cost_cents" INTEGER,
    "margin_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_line_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "quote_id" TEXT,
    "method" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reference" TEXT,
    "state" TEXT NOT NULL DEFAULT 'received',
    "received_at" TIMESTAMP(3),
    "matched_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_link" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "xero_invoice_id" TEXT NOT NULL,
    "xero_number" TEXT,
    "state" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_on" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "state" "ProofState" NOT NULL DEFAULT 'awaiting_sheet',
    "round" INTEGER NOT NULL DEFAULT 0,
    "sheet_key" TEXT,
    "sheet_sha256" TEXT,
    "upload_token_hash" TEXT,
    "approved_by_staff_id" TEXT,
    "with_client_at" TIMESTAMP(3),
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature" (
    "id" TEXT NOT NULL,
    "proof_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "person_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "words_shown" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "sheet_sha256" TEXT NOT NULL,
    "record_sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "courier" TEXT NOT NULL,
    "service" TEXT,
    "waybill" TEXT NOT NULL,
    "cartons" INTEGER,
    "tracking_url" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_event" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "placed_by_staff_id" TEXT NOT NULL,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_kit" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "source_kind" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_logo" (
    "id" TEXT NOT NULL,
    "brand_kit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blob_key" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_logo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_colour" (
    "id" TEXT NOT NULL,
    "brand_kit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "nearest_thread" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_colour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_font" (
    "id" TEXT NOT NULL,
    "brand_kit_id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "use" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_font_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_rule" (
    "id" TEXT NOT NULL,
    "brand_kit_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_file" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "blob_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'client',
    "check_result" JSONB,
    "needs_redraw" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_item" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "design_ref" TEXT,
    "design_rev" INTEGER,
    "mockup_key" TEXT,
    "guide_unit_cents" INTEGER,
    "guide_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "person_id" TEXT,
    "party" TEXT NOT NULL DEFAULT 'client',
    "channel" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "external_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "whatsapp_name" TEXT,
    "category" TEXT,
    "approval" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "client_id" TEXT,
    "audience" "EventAudience" NOT NULL DEFAULT 'staff',
    "data" JSONB NOT NULL DEFAULT '{}',
    "actor" TEXT NOT NULL,
    "actor_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL,
    "locked_until" TIMESTAMP(3),
    "last_error" TEXT,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_inbox" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "clerk_user_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_log" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_clerk_org_id_key" ON "client"("clerk_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_clerk_user_id_key" ON "person"("clerk_user_id");

-- CreateIndex
CREATE INDEX "person_client_id_idx" ON "person"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_role_person_id_key" ON "person_role"("person_id");

-- CreateIndex
CREATE INDEX "address_client_id_idx" ON "address"("client_id");

-- CreateIndex
CREATE INDEX "project_client_id_idx" ON "project"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_source_client_id_key" ON "client_source"("client_id");

-- CreateIndex
CREATE INDEX "client_note_client_id_idx" ON "client_note"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_identity_channel_address_key" ON "channel_identity"("channel", "address");

-- CreateIndex
CREATE INDEX "conversation_client_id_idx" ON "conversation"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_external_id_key" ON "message"("external_id");

-- CreateIndex
CREATE INDEX "message_conversation_id_sent_at_idx" ON "message"("conversation_id", "sent_at");

-- CreateIndex
CREATE INDEX "attachment_message_id_idx" ON "attachment"("message_id");

-- CreateIndex
CREATE INDEX "enquiry_status_idx" ON "enquiry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "brief_enquiry_id_key" ON "brief"("enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_ref_key" ON "quote"("ref");

-- CreateIndex
CREATE INDEX "quote_client_id_idx" ON "quote"("client_id");

-- CreateIndex
CREATE INDEX "quote_state_idx" ON "quote"("state");

-- CreateIndex
CREATE UNIQUE INDEX "quote_version_quote_id_version_key" ON "quote_version"("quote_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "quote_version_staff_quote_version_id_key" ON "quote_version_staff"("quote_version_id");

-- CreateIndex
CREATE INDEX "quote_line_quote_id_idx" ON "quote_line"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_line_staff_quote_line_id_key" ON "quote_line_staff"("quote_line_id");

-- CreateIndex
CREATE INDEX "amendment_quote_line_id_idx" ON "amendment"("quote_line_id");

-- CreateIndex
CREATE INDEX "amendment_state_idx" ON "amendment"("state");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_quote_id_kind_key" ON "follow_up"("quote_id", "kind");

-- CreateIndex
CREATE INDEX "decline_quote_id_idx" ON "decline"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "costing_request_ref_key" ON "costing_request"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "costing_request_reply_token_hash_key" ON "costing_request"("reply_token_hash");

-- CreateIndex
CREATE INDEX "costing_request_state_idx" ON "costing_request"("state");

-- CreateIndex
CREATE UNIQUE INDEX "costing_answer_costing_request_id_key" ON "costing_answer"("costing_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_ref_key" ON "order"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "order_nelson_order_ref_key" ON "order"("nelson_order_ref");

-- CreateIndex
CREATE INDEX "order_client_id_idx" ON "order"("client_id");

-- CreateIndex
CREATE INDEX "order_state_idx" ON "order"("state");

-- CreateIndex
CREATE INDEX "order_line_order_id_idx" ON "order_line"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_staff_order_line_id_key" ON "order_line_staff"("order_line_id");

-- CreateIndex
CREATE INDEX "payment_order_id_idx" ON "payment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_link_xero_invoice_id_key" ON "invoice_link"("xero_invoice_id");

-- CreateIndex
CREATE INDEX "invoice_link_order_id_idx" ON "invoice_link"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "proof_ref_key" ON "proof"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "proof_order_id_key" ON "proof"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "proof_upload_token_hash_key" ON "proof"("upload_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "signature_proof_id_round_key" ON "signature"("proof_id", "round");

-- CreateIndex
CREATE INDEX "shipment_order_id_idx" ON "shipment"("order_id");

-- CreateIndex
CREATE INDEX "shipment_event_shipment_id_occurred_at_idx" ON "shipment_event"("shipment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "hold_order_id_idx" ON "hold"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_kit_client_id_key" ON "brand_kit"("client_id");

-- CreateIndex
CREATE INDEX "brand_logo_brand_kit_id_idx" ON "brand_logo"("brand_kit_id");

-- CreateIndex
CREATE INDEX "brand_colour_brand_kit_id_idx" ON "brand_colour"("brand_kit_id");

-- CreateIndex
CREATE INDEX "brand_font_brand_kit_id_idx" ON "brand_font"("brand_kit_id");

-- CreateIndex
CREATE INDEX "brand_rule_brand_kit_id_idx" ON "brand_rule"("brand_kit_id");

-- CreateIndex
CREATE INDEX "artwork_file_client_id_idx" ON "artwork_file"("client_id");

-- CreateIndex
CREATE INDEX "store_item_client_id_idx" ON "store_item"("client_id");

-- CreateIndex
CREATE INDEX "notification_event_id_idx" ON "notification"("event_id");

-- CreateIndex
CREATE INDEX "notification_person_id_idx" ON "notification"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_key_key" ON "template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "preference_person_id_kind_channel_key" ON "preference"("person_id", "kind", "channel");

-- CreateIndex
CREATE INDEX "event_subject_type_subject_id_occurred_at_idx" ON "event"("subject_type", "subject_id", "occurred_at");

-- CreateIndex
CREATE INDEX "event_client_id_occurred_at_idx" ON "event"("client_id", "occurred_at");

-- CreateIndex
CREATE INDEX "event_resolved_at_due_at_idx" ON "event"("resolved_at", "due_at");

-- CreateIndex
CREATE INDEX "outbox_status_next_attempt_at_idx" ON "outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_inbox_source_external_id_key" ON "webhook_inbox"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_email_key" ON "staff_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_clerk_user_id_key" ON "staff_user"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_key_hash_key" ON "agent"("key_hash");

-- CreateIndex
CREATE INDEX "agent_log_agent_id_created_at_idx" ON "agent_log"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_subject_type_subject_id_idx" ON "audit_log"("subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "setting_key_key" ON "setting"("key");

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_role" ADD CONSTRAINT "person_role_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_version" ADD CONSTRAINT "quote_version_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

