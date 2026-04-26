CREATE TABLE "bill_item" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_version_id" text NOT NULL,
	"parent_id" text,
	"item_code" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	"sort_no" integer NOT NULL,
	"system_unit_price" double precision,
	"manual_unit_price" double precision,
	"final_unit_price" double precision,
	"system_amount" double precision,
	"final_amount" double precision,
	"calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_version" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text NOT NULL,
	"discipline_code" text NOT NULL,
	"version_no" integer NOT NULL,
	"version_name" text NOT NULL,
	"version_status" text NOT NULL,
	"source_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_work_item" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_item_id" text NOT NULL,
	"work_content" text NOT NULL,
	"sort_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_discipline" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"discipline_code" text NOT NULL,
	"discipline_name" text NOT NULL,
	"default_standard_set_code" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member_scope" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text NOT NULL,
	"stage_name" text NOT NULL,
	"status" text NOT NULL,
	"sequence_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_item" ADD CONSTRAINT "bill_item_bill_version_id_bill_version_id_fk" FOREIGN KEY ("bill_version_id") REFERENCES "public"."bill_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_version" ADD CONSTRAINT "bill_version_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_work_item" ADD CONSTRAINT "bill_work_item_bill_item_id_bill_item_id_fk" FOREIGN KEY ("bill_item_id") REFERENCES "public"."bill_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_discipline" ADD CONSTRAINT "project_discipline_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member_scope" ADD CONSTRAINT "project_member_scope_member_id_project_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."project_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stage" ADD CONSTRAINT "project_stage_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_item_version_idx" ON "bill_item" USING btree ("bill_version_id");--> statement-breakpoint
CREATE INDEX "bill_item_sort_idx" ON "bill_item" USING btree ("bill_version_id","sort_no");--> statement-breakpoint
CREATE INDEX "bill_item_parent_idx" ON "bill_item" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "bill_version_project_idx" ON "bill_version" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bill_version_context_idx" ON "bill_version" USING btree ("project_id","stage_code","discipline_code","version_no");--> statement-breakpoint
CREATE INDEX "bill_work_item_bill_item_idx" ON "bill_work_item" USING btree ("bill_item_id");--> statement-breakpoint
CREATE INDEX "bill_work_item_sort_idx" ON "bill_work_item" USING btree ("bill_item_id","sort_no");--> statement-breakpoint
CREATE INDEX "project_discipline_project_idx" ON "project_discipline" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_discipline_code_idx" ON "project_discipline" USING btree ("project_id","discipline_code");--> statement-breakpoint
CREATE INDEX "project_member_scope_member_idx" ON "project_member_scope" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "project_member_project_idx" ON "project_member" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_member_user_idx" ON "project_member" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_stage_project_idx" ON "project_stage" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_stage_sequence_idx" ON "project_stage" USING btree ("project_id","sequence_no");