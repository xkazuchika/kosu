PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monthly_effort_submissions` (
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
	FOREIGN KEY (`invalidated_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "monthly_effort_submissions_status_check" CHECK("__new_monthly_effort_submissions"."status" IN ('draft', 'submitted')),
	CONSTRAINT "monthly_effort_submissions_month_check" CHECK(length("__new_monthly_effort_submissions"."month") = 7 AND "__new_monthly_effort_submissions"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr("__new_monthly_effort_submissions"."month", 6, 2) BETWEEN '01' AND '12')
);
--> statement-breakpoint
INSERT INTO `__new_monthly_effort_submissions`("id", "member_id", "month", "status", "submitted_by_member_id", "submitted_at", "invalidated_by_member_id", "invalidated_at", "is_legacy_migration", "created_at", "updated_at") SELECT "id", "member_id", "month", "status", "submitted_by_member_id", "submitted_at", "invalidated_by_member_id", "invalidated_at", "is_legacy_migration", "created_at", "updated_at" FROM `monthly_effort_submissions`;--> statement-breakpoint
DROP TABLE `monthly_effort_submissions`;--> statement-breakpoint
ALTER TABLE `__new_monthly_effort_submissions` RENAME TO `monthly_effort_submissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_month_status_index` ON `monthly_effort_submissions` (`month`,`status`);--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_submitted_by_index` ON `monthly_effort_submissions` (`submitted_by_member_id`);--> statement-breakpoint
CREATE INDEX `monthly_effort_submissions_invalidated_by_index` ON `monthly_effort_submissions` (`invalidated_by_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_effort_submission_member_month_unique` ON `monthly_effort_submissions` (`member_id`,`month`);