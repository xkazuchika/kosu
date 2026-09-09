CREATE TABLE `monthly_effort_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_by_member_id` text,
	`submitted_at` text,
	`invalidated_by_member_id` text,
	`invalidated_at` text,
	`is_legacy_migration` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invalidated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_month_status_index` ON `monthly_effort_submissions` (`month`,`status`);--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_submitted_by_index` ON `monthly_effort_submissions` (`submitted_by_member_id`);--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_invalidated_by_index` ON `monthly_effort_submissions` (`invalidated_by_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_effort_submission_member_month_unique` ON `monthly_effort_submissions` (`member_id`,`month`);--> statement-breakpoint
INSERT OR IGNORE INTO `monthly_effort_submissions` (
	`id`,
	`member_id`,
	`month`,
	`status`,
	`submitted_by_member_id`,
	`submitted_at`,
	`is_legacy_migration`,
	`created_at`,
	`updated_at`
)
SELECT
	'legacy-monthly-effort-submission:' || close_record.month || ':' || member.id,
	member.id,
	close_record.month,
	'submitted',
	NULL,
	COALESCE(
		close_record.approved_at,
		close_record.entered_review_at,
		close_record.updated_at,
		close_record.created_at,
		CURRENT_TIMESTAMP
	),
	1,
	COALESCE(
		close_record.approved_at,
		close_record.entered_review_at,
		close_record.updated_at,
		close_record.created_at,
		CURRENT_TIMESTAMP
	),
	COALESCE(
		close_record.approved_at,
		close_record.entered_review_at,
		close_record.updated_at,
		close_record.created_at,
		CURRENT_TIMESTAMP
	)
FROM `monthly_cost_closes` AS close_record
CROSS JOIN `members` AS member
WHERE close_record.status IN ('in_review', 'approved')
AND (
	(member.is_active = 1 AND substr(member.created_at, 1, 7) <= close_record.month)
	OR EXISTS (
		SELECT 1 FROM `member_monthly_capacities` AS capacity
		WHERE capacity.member_id = member.id AND capacity.month = close_record.month
	)
	OR EXISTS (
		SELECT 1 FROM `monthly_plans` AS monthly_plan
		WHERE monthly_plan.member_id = member.id AND monthly_plan.month = close_record.month
	)
	OR EXISTS (
		SELECT 1 FROM `daily_allocation_plans` AS daily_plan
		WHERE daily_plan.member_id = member.id
		AND substr(daily_plan.plan_date, 1, 7) = close_record.month
	)
	OR EXISTS (
		SELECT 1 FROM `daily_work_logs` AS work_log
		WHERE work_log.member_id = member.id
		AND substr(work_log.work_date, 1, 7) = close_record.month
	)
	OR EXISTS (
		SELECT 1
		FROM `effort_allocations` AS allocation
		INNER JOIN `daily_work_logs` AS allocation_work_log
			ON allocation_work_log.id = allocation.daily_work_log_id
		WHERE allocation.member_id = member.id
		AND substr(allocation_work_log.work_date, 1, 7) = close_record.month
	)
);
