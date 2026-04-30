ALTER TABLE "variance_warning_threshold" ADD COLUMN "discipline_code" text;
--> statement-breakpoint
DROP INDEX "variance_warning_threshold_project_idx";
--> statement-breakpoint
CREATE INDEX "variance_warning_threshold_project_idx" ON "variance_warning_threshold" USING btree ("project_id","stage_code","discipline_code");
