ALTER TABLE monthly_cost_closes ADD COLUMN effort_status text NOT NULL DEFAULT 'open' CONSTRAINT monthly_cost_closes_effort_status_check CHECK(effort_status IN ('open', 'in_review', 'confirmed'));
--> statement-breakpoint
ALTER TABLE monthly_cost_closes ADD COLUMN effort_reviewed_by_member_id text REFERENCES members(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE monthly_cost_closes ADD COLUMN effort_reviewed_at text;
--> statement-breakpoint
ALTER TABLE monthly_cost_closes ADD COLUMN effort_confirmed_by_member_id text REFERENCES members(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE monthly_cost_closes ADD COLUMN effort_confirmed_at text;
--> statement-breakpoint
ALTER TABLE monthly_cost_close_events ADD COLUMN previous_effort_status text;
--> statement-breakpoint
ALTER TABLE monthly_cost_close_events ADD COLUMN next_effort_status text;
--> statement-breakpoint
UPDATE monthly_cost_closes SET
  effort_status = CASE status WHEN 'approved' THEN 'confirmed' WHEN 'in_review' THEN 'in_review' ELSE 'open' END,
  effort_reviewed_by_member_id = CASE WHEN status <> 'open' THEN entered_review_by_member_id END,
  effort_reviewed_at = CASE WHEN status <> 'open' THEN entered_review_at END,
  effort_confirmed_by_member_id = CASE WHEN status = 'approved' THEN approved_by_member_id END,
  effort_confirmed_at = CASE WHEN status = 'approved' THEN approved_at END;
--> statement-breakpoint
INSERT INTO monthly_cost_close_events
  (id, close_id, event_type, previous_status, next_status, next_effort_status, reason, occurred_at)
SELECT lower(hex(randomblob(16))), id, 'effort_migration', status, status, effort_status,
  '工数と原価の状態を分離。既存の原価状態と履歴を保持。', CURRENT_TIMESTAMP
FROM monthly_cost_closes;
