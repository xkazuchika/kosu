CREATE TABLE `monthly_cost_close_events` (
	`id` text PRIMARY KEY NOT NULL,
	`close_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_member_id` text,
	`previous_status` text,
	`next_status` text,
	`reason` text,
	`target_type` text,
	`target_id` text,
	`previous_hourly_cost_rate` integer,
	`next_hourly_cost_rate` integer,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`close_id`) REFERENCES `monthly_cost_closes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `monthly_cost_close_events_close_occurred_index` ON `monthly_cost_close_events` (`close_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `monthly_cost_close_events_actor_index` ON `monthly_cost_close_events` (`actor_member_id`);--> statement-breakpoint
CREATE TABLE `monthly_cost_close_project_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`close_id` text NOT NULL,
	`project_id` text NOT NULL,
	`project_code` text NOT NULL,
	`project_name` text NOT NULL,
	`project_type` text NOT NULL,
	`project_is_archived` integer NOT NULL,
	`legacy_revenue_or_budget_amount` integer,
	`contract_revenue_amount` integer,
	`labor_cost_budget_amount` integer,
	`monthly_planned_cost` integer NOT NULL,
	`monthly_actual_cost` integer NOT NULL,
	`cumulative_actual_cost` integer NOT NULL,
	`remaining_labor_cost_budget` integer,
	`labor_budget_consumption` real,
	`target_labor_gross_profit` integer,
	`target_labor_gross_profit_rate` real,
	`final_labor_gross_profit` integer,
	`final_labor_gross_profit_rate` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`close_id`) REFERENCES `monthly_cost_closes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `monthly_cost_close_project_snapshots_close_index` ON `monthly_cost_close_project_snapshots` (`close_id`);--> statement-breakpoint
CREATE INDEX `monthly_cost_close_project_snapshots_project_index` ON `monthly_cost_close_project_snapshots` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_cost_close_project_snapshot_close_project_unique` ON `monthly_cost_close_project_snapshots` (`close_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `monthly_cost_closes` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`entered_review_by_member_id` text,
	`entered_review_at` text,
	`approved_by_member_id` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entered_review_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`approved_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_cost_closes_month_unique` ON `monthly_cost_closes` (`month`);--> statement-breakpoint
CREATE INDEX `monthly_cost_closes_month_index` ON `monthly_cost_closes` (`month`);--> statement-breakpoint
CREATE INDEX `monthly_cost_closes_status_month_index` ON `monthly_cost_closes` (`status`,`month`);--> statement-breakpoint
INSERT INTO `monthly_cost_closes` (
	`id`,
	`month`,
	`status`,
	`entered_review_by_member_id`,
	`entered_review_at`,
	`created_at`,
	`updated_at`
)
SELECT
	'legacy-close-' || `id`,
	`month`,
	'in_review',
	`locked_by_member_id`,
	COALESCE(`locked_at`, `updated_at`, `created_at`, CURRENT_TIMESTAMP),
	COALESCE(`created_at`, CURRENT_TIMESTAMP),
	COALESCE(`updated_at`, `locked_at`, `created_at`, CURRENT_TIMESTAMP)
FROM `period_locks`
WHERE `is_locked` = 1;--> statement-breakpoint
INSERT INTO `monthly_cost_close_events` (
	`id`,
	`close_id`,
	`event_type`,
	`actor_member_id`,
	`previous_status`,
	`next_status`,
	`reason`,
	`occurred_at`,
	`created_at`
)
SELECT
	'legacy-event-' || `id`,
	'legacy-close-' || `id`,
	'migration',
	`locked_by_member_id`,
	'open',
	'in_review',
	'旧月次ロックから移行',
	COALESCE(`locked_at`, `updated_at`, `created_at`, CURRENT_TIMESTAMP),
	COALESCE(`locked_at`, `updated_at`, `created_at`, CURRENT_TIMESTAMP)
FROM `period_locks`
WHERE `is_locked` = 1;
