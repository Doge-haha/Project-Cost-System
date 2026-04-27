CREATE TABLE "skill_definition" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_code" text NOT NULL,
	"skill_name" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL,
	"runtime_config" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"from_type" text NOT NULL,
	"from_id" text NOT NULL,
	"to_type" text NOT NULL,
	"to_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_relation" ADD CONSTRAINT "knowledge_relation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_definition_code_idx" ON "skill_definition" USING btree ("skill_code");--> statement-breakpoint
CREATE INDEX "skill_definition_status_idx" ON "skill_definition" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_relation_project_idx" ON "knowledge_relation" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "knowledge_relation_from_idx" ON "knowledge_relation" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "knowledge_relation_to_idx" ON "knowledge_relation" USING btree ("to_type","to_id");
