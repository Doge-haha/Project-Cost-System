CREATE TABLE "process_document" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text NOT NULL,
	"discipline_code" text NOT NULL,
	"document_type" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"reference_no" text NOT NULL,
	"amount" double precision NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"last_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_document" ADD CONSTRAINT "process_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "process_document_project_idx" ON "process_document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "process_document_status_idx" ON "process_document" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "process_document_context_idx" ON "process_document" USING btree ("project_id","stage_code","discipline_code","document_type");