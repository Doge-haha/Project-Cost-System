CREATE TABLE "import_task" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_label" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"total_item_count" integer NOT NULL,
	"imported_item_count" integer NOT NULL,
	"memory_item_count" integer NOT NULL,
	"failed_item_count" integer NOT NULL,
	"latest_job_id" text,
	"latest_error_message" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "import_task" ADD CONSTRAINT "import_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_task_project_idx" ON "import_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "import_task_status_idx" ON "import_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_task_created_idx" ON "import_task" USING btree ("created_at");