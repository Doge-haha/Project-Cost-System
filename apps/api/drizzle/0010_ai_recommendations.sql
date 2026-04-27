CREATE TABLE "ai_recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_code" text,
	"discipline_code" text,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"recommendation_type" text NOT NULL,
	"input_payload" jsonb NOT NULL,
	"output_payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"status_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_recommendation" ADD CONSTRAINT "ai_recommendation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_recommendation_project_resource_idx" ON "ai_recommendation" USING btree ("project_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "ai_recommendation_status_created_idx" ON "ai_recommendation" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ai_recommendation_type_created_idx" ON "ai_recommendation" USING btree ("recommendation_type","created_at");
