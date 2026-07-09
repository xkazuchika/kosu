CREATE TABLE `daily_allocation_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`project_id` text NOT NULL,
	`plan_date` text NOT NULL,
	`planned_hours` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_allocation_plans_member_date_index` ON `daily_allocation_plans` (`member_id`,`plan_date`);--> statement-breakpoint
CREATE INDEX `daily_allocation_plans_project_date_index` ON `daily_allocation_plans` (`project_id`,`plan_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_allocation_plan_member_date_project_unique` ON `daily_allocation_plans` (`member_id`,`plan_date`,`project_id`);