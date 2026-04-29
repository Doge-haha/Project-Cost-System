ALTER TABLE "bill_version" ADD COLUMN "source_spec_code" text;--> statement-breakpoint
ALTER TABLE "bill_version" ADD COLUMN "source_spec_name" text;--> statement-breakpoint
ALTER TABLE "bill_version" ADD COLUMN "source_visible_flag" boolean;--> statement-breakpoint
ALTER TABLE "bill_version" ADD COLUMN "source_default_flag" boolean;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "source_bill_id" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "source_sequence" integer;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "source_level_code" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "is_measure_item" boolean;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "source_reference_price" double precision;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "source_fee_id" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "measure_category" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "measure_fee_flag" boolean;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "measure_category_subtype" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD COLUMN "feature_rule_text" text;--> statement-breakpoint
ALTER TABLE "bill_work_item" ADD COLUMN "source_spec_code" text;--> statement-breakpoint
ALTER TABLE "bill_work_item" ADD COLUMN "source_bill_id" text;--> statement-breakpoint
ALTER TABLE "bill_item" ADD CONSTRAINT "bill_item_parent_id_bill_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bill_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_item_business_uidx" ON "bill_item" USING btree ("bill_version_id","item_code","parent_id");
