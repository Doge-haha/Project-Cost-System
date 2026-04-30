CREATE TABLE "variance_warning_threshold" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text,
	"threshold_amount" double precision NOT NULL,
	"threshold_rate" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variance_warning_threshold" ADD CONSTRAINT "variance_warning_threshold_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "variance_warning_threshold_project_idx" ON "variance_warning_threshold" USING btree ("project_id","stage_code");
