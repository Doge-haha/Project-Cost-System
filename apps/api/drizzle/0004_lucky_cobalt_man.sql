CREATE TABLE "fee_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"fee_template_id" text NOT NULL,
	"discipline_code" text,
	"fee_type" text NOT NULL,
	"fee_rate" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_template" (
	"id" text PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"project_type" text,
	"region_code" text,
	"stage_scope" text[] NOT NULL,
	"tax_mode" text NOT NULL,
	"allocation_mode" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_item" (
	"id" text PRIMARY KEY NOT NULL,
	"price_version_id" text NOT NULL,
	"quota_code" text NOT NULL,
	"labor_unit_price" double precision NOT NULL,
	"material_unit_price" double precision NOT NULL,
	"machine_unit_price" double precision NOT NULL,
	"total_unit_price" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_version" (
	"id" text PRIMARY KEY NOT NULL,
	"version_code" text NOT NULL,
	"version_name" text NOT NULL,
	"region_code" text NOT NULL,
	"discipline_code" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_rule" ADD CONSTRAINT "fee_rule_fee_template_id_fee_template_id_fk" FOREIGN KEY ("fee_template_id") REFERENCES "public"."fee_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_item" ADD CONSTRAINT "price_item_price_version_id_price_version_id_fk" FOREIGN KEY ("price_version_id") REFERENCES "public"."price_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fee_rule_template_idx" ON "fee_rule" USING btree ("fee_template_id");--> statement-breakpoint
CREATE INDEX "fee_template_region_idx" ON "fee_template" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "fee_template_project_type_idx" ON "fee_template" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "price_item_version_idx" ON "price_item" USING btree ("price_version_id");--> statement-breakpoint
CREATE INDEX "price_item_quota_idx" ON "price_item" USING btree ("price_version_id","quota_code");--> statement-breakpoint
CREATE INDEX "price_version_code_idx" ON "price_version" USING btree ("version_code");--> statement-breakpoint
CREATE INDEX "price_version_filter_idx" ON "price_version" USING btree ("region_code","discipline_code","status");