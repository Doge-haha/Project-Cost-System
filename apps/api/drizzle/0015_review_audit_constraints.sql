CREATE UNIQUE INDEX "review_submission_pending_bill_version_uidx" ON "review_submission" USING btree ("bill_version_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "audit_log_resource_created_idx" ON "audit_log" USING btree ("resource_type","resource_id","created_at" DESC);
