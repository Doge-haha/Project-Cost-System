CREATE TABLE "discipline_type" (
  "id" text PRIMARY KEY NOT NULL,
  "discipline_code" text NOT NULL,
  "discipline_name" text NOT NULL,
  "discipline_group" text,
  "business_view_type" text,
  "region_code" text,
  "source_markup" text,
  "gb08_code" text,
  "gb13_code" text,
  "source_system" text,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discipline_type_code_uidx" ON "discipline_type" USING btree ("discipline_code");
--> statement-breakpoint
CREATE INDEX "discipline_type_filter_idx" ON "discipline_type" USING btree ("region_code","status");
--> statement-breakpoint
CREATE TABLE "standard_set" (
  "id" text PRIMARY KEY NOT NULL,
  "standard_set_code" text NOT NULL,
  "standard_set_name" text NOT NULL,
  "discipline_code" text NOT NULL,
  "region_code" text,
  "version_year" integer,
  "standard_type" text,
  "source_field_code" text,
  "source_markup" text,
  "source_system" text,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "standard_set_code_uidx" ON "standard_set" USING btree ("standard_set_code");
--> statement-breakpoint
CREATE INDEX "standard_set_discipline_idx" ON "standard_set" USING btree ("discipline_code","region_code","status");
