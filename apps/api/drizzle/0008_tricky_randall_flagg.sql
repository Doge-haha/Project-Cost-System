CREATE TABLE "knowledge_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text,
	"source_job_id" text,
	"source_type" text NOT NULL,
	"source_action" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text,
	"source_job_id" text,
	"memory_key" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_entry" ADD CONSTRAINT "knowledge_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_entry" ADD CONSTRAINT "memory_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_entry_project_idx" ON "knowledge_entry" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_entry_source_idx" ON "knowledge_entry" USING btree ("source_job_id","source_type","source_action");--> statement-breakpoint
CREATE INDEX "knowledge_entry_created_idx" ON "knowledge_entry" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "memory_entry_project_idx" ON "memory_entry" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "memory_entry_source_idx" ON "memory_entry" USING btree ("source_job_id");--> statement-breakpoint
CREATE INDEX "memory_entry_subject_idx" ON "memory_entry" USING btree ("subject_type","subject_id");