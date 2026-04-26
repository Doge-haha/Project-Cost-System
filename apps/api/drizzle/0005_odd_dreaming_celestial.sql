CREATE TABLE "review_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"bill_version_id" text NOT NULL,
	"stage_code" text NOT NULL,
	"discipline_code" text NOT NULL,
	"status" text NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"submission_comment" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_submission" ADD CONSTRAINT "review_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_submission" ADD CONSTRAINT "review_submission_bill_version_id_bill_version_id_fk" FOREIGN KEY ("bill_version_id") REFERENCES "public"."bill_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_submission_project_idx" ON "review_submission" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "review_submission_bill_version_idx" ON "review_submission" USING btree ("bill_version_id","status");