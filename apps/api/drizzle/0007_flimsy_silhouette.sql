CREATE TABLE "background_job" (
	"id" text PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"project_id" text,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "report_export_task" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"report_type" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"stage_code" text,
	"discipline_code" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"result_preview" jsonb,
	"download_file_name" text,
	"download_content_type" text,
	"download_content_length" integer
);
--> statement-breakpoint
ALTER TABLE "background_job" ADD CONSTRAINT "background_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_export_task" ADD CONSTRAINT "report_export_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "background_job_project_idx" ON "background_job" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "background_job_status_idx" ON "background_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "background_job_type_idx" ON "background_job" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "background_job_created_idx" ON "background_job" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_export_project_idx" ON "report_export_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "report_export_status_idx" ON "report_export_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_export_created_idx" ON "report_export_task" USING btree ("created_at");