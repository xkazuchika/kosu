CREATE TABLE `daily_work_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`work_date` text NOT NULL,
	`total_working_hours` real NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_work_logs_member_date_index` ON `daily_work_logs` (`member_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `daily_work_logs_work_date_index` ON `daily_work_logs` (`work_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_work_log_member_date_unique` ON `daily_work_logs` (`member_id`,`work_date`);--> statement-breakpoint
CREATE TABLE `effort_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_work_log_id` text NOT NULL,
	`member_id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text,
	`allocated_hours` real NOT NULL,
	`note` text,
	`hourly_cost_rate_snapshot` integer,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`daily_work_log_id`) REFERENCES `daily_work_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `effort_allocations_daily_work_log_index` ON `effort_allocations` (`daily_work_log_id`);--> statement-breakpoint
CREATE INDEX `effort_allocations_member_project_index` ON `effort_allocations` (`member_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `effort_allocations_member_task_index` ON `effort_allocations` (`member_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `effort_allocations_project_member_index` ON `effort_allocations` (`project_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`import_type` text NOT NULL,
	`status` text NOT NULL,
	`file_name` text,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`valid_rows` integer DEFAULT 0 NOT NULL,
	`invalid_rows` integer DEFAULT 0 NOT NULL,
	`result_summary` text,
	`created_by_member_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`committed_at` text,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_jobs_status_type_index` ON `import_jobs` (`status`,`import_type`);--> statement-breakpoint
CREATE TABLE `member_monthly_capacities` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`month` text NOT NULL,
	`capacity_hours` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_monthly_capacities_member_month_index` ON `member_monthly_capacities` (`member_id`,`month`);--> statement-breakpoint
CREATE INDEX `member_monthly_capacities_month_index` ON `member_monthly_capacities` (`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_monthly_capacity_member_month_unique` ON `member_monthly_capacities` (`member_id`,`month`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`department_name` text,
	`hourly_cost_rate` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE INDEX `members_department_role_index` ON `members` (`department_name`,`role`);--> statement-breakpoint
CREATE INDEX `members_role_active_index` ON `members` (`role`,`is_active`);--> statement-breakpoint
CREATE TABLE `monthly_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`project_id` text NOT NULL,
	`month` text NOT NULL,
	`assignment_role` text DEFAULT '' NOT NULL,
	`planned_hours` real NOT NULL,
	`hourly_cost_rate_snapshot` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monthly_plans_member_month_index` ON `monthly_plans` (`member_id`,`month`);--> statement-breakpoint
CREATE INDEX `monthly_plans_project_month_index` ON `monthly_plans` (`project_id`,`month`);--> statement-breakpoint
CREATE INDEX `monthly_plans_month_index` ON `monthly_plans` (`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_plan_member_project_month_role_unique` ON `monthly_plans` (`member_id`,`project_id`,`month`,`assignment_role`);--> statement-breakpoint
CREATE TABLE `period_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`is_locked` integer DEFAULT true NOT NULL,
	`locked_by_member_id` text,
	`locked_at` text,
	`unlocked_by_member_id` text,
	`unlocked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`locked_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`unlocked_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `period_locks_month_unique` ON `period_locks` (`month`);--> statement-breakpoint
CREATE INDEX `period_locks_month_index` ON `period_locks` (`month`);--> statement-breakpoint
CREATE TABLE `project_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`project_id` text NOT NULL,
	`assignment_role` text,
	`assignment_source` text DEFAULT 'admin' NOT NULL,
	`assigned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`removed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_assignments_member_project_index` ON `project_assignments` (`member_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `project_assignments_project_member_index` ON `project_assignments` (`project_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `project_assignments_source_index` ON `project_assignments` (`assignment_source`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`project_type` text NOT NULL,
	`client_name` text,
	`description` text,
	`revenue_or_budget_amount` integer,
	`is_archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_code_unique` ON `projects` (`code`);--> statement-breakpoint
CREATE INDEX `projects_type_archived_index` ON `projects` (`project_type`,`is_archived`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_member_id_index` ON `sessions` (`member_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_index` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_project_archived_index` ON `tasks` (`project_id`,`is_archived`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`default_timezone` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
