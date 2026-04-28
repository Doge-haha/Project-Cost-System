CREATE TABLE "reference_quota" (
	"id" text PRIMARY KEY NOT NULL,
	"source_dataset" text NOT NULL,
	"source_region" text,
	"standard_set_code" text NOT NULL,
	"discipline_code" text,
	"source_quota_id" text NOT NULL,
	"source_sequence" integer,
	"chapter_code" text NOT NULL,
	"quota_code" text NOT NULL,
	"quota_name" text NOT NULL,
	"unit" text NOT NULL,
	"labor_fee" double precision,
	"material_fee" double precision,
	"machine_fee" double precision,
	"work_content_summary" text,
	"resource_composition_summary" text,
	"search_text" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reference_quota_standard_set_idx" ON "reference_quota" USING btree ("standard_set_code","discipline_code");
--> statement-breakpoint
CREATE INDEX "reference_quota_keyword_idx" ON "reference_quota" USING btree ("quota_code","quota_name");
--> statement-breakpoint
CREATE INDEX "reference_quota_dataset_idx" ON "reference_quota" USING btree ("source_dataset","source_region");
