DROP INDEX IF EXISTS "project_code_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_code_uidx" ON "project" USING btree ("code");--> statement-breakpoint
DROP INDEX IF EXISTS "project_stage_sequence_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_stage_sequence_uidx" ON "project_stage" USING btree ("project_id","sequence_no");--> statement-breakpoint
CREATE UNIQUE INDEX "project_stage_code_uidx" ON "project_stage" USING btree ("project_id","stage_code");--> statement-breakpoint
DROP INDEX IF EXISTS "project_discipline_code_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_discipline_code_uidx" ON "project_discipline" USING btree ("project_id","discipline_code");--> statement-breakpoint
DROP INDEX IF EXISTS "project_member_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_member_user_uidx" ON "project_member" USING btree ("project_id","user_id");--> statement-breakpoint
DROP INDEX IF EXISTS "bill_version_context_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "bill_version_context_uidx" ON "bill_version" USING btree ("project_id","stage_code","discipline_code","version_no");--> statement-breakpoint
DROP INDEX IF EXISTS "bill_work_item_sort_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "bill_work_item_sort_uidx" ON "bill_work_item" USING btree ("bill_item_id","sort_no");--> statement-breakpoint
DROP INDEX IF EXISTS "price_version_code_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "price_version_code_uidx" ON "price_version" USING btree ("version_code");--> statement-breakpoint
DROP INDEX IF EXISTS "price_item_quota_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "price_item_quota_uidx" ON "price_item" USING btree ("price_version_id","quota_code");
