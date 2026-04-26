CREATE TABLE "quota_line" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_item_id" text NOT NULL,
	"source_standard_set_code" text NOT NULL,
	"source_quota_id" text NOT NULL,
	"source_sequence" integer,
	"chapter_code" text NOT NULL,
	"quota_code" text NOT NULL,
	"quota_name" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" double precision NOT NULL,
	"labor_fee" double precision,
	"material_fee" double precision,
	"machine_fee" double precision,
	"content_factor" double precision NOT NULL,
	"source_mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quota_line" ADD CONSTRAINT "quota_line_bill_item_id_bill_item_id_fk" FOREIGN KEY ("bill_item_id") REFERENCES "public"."bill_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quota_line_bill_item_idx" ON "quota_line" USING btree ("bill_item_id");--> statement-breakpoint
CREATE INDEX "quota_line_quota_code_idx" ON "quota_line" USING btree ("bill_item_id","quota_code");