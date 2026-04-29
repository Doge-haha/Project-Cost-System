CREATE INDEX "knowledge_entry_type_status_created_idx" ON "knowledge_entry" USING btree ("source_type","source_action","created_at");--> statement-breakpoint
CREATE INDEX "memory_entry_scope_key_idx" ON "memory_entry" USING btree ("subject_type","subject_id","memory_key");
