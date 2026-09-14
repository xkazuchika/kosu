CREATE TABLE `member_monthly_plan_reviews` (
	`member_id` text NOT NULL,
	`month` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`confirmed_by_member_id` text,
	`confirmed_at` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`confirmed_by_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "member_monthly_plan_reviews_revision_check" CHECK(typeof("member_monthly_plan_reviews"."revision") = 'integer' AND "member_monthly_plan_reviews"."revision" >= 0),
	CONSTRAINT "member_monthly_plan_reviews_month_check" CHECK(length("member_monthly_plan_reviews"."month") = 7 AND "member_monthly_plan_reviews"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr("member_monthly_plan_reviews"."month", 1, 4) >= '0001' AND substr("member_monthly_plan_reviews"."month", 6, 2) BETWEEN '01' AND '12')
);
--> statement-breakpoint
CREATE INDEX `member_monthly_plan_reviews_month_index` ON `member_monthly_plan_reviews` (`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_monthly_plan_reviews_member_month_unique` ON `member_monthly_plan_reviews` (`member_id`,`month`);

--> statement-breakpoint
CREATE TRIGGER monthly_plans_invalidate_plan_review_insert
AFTER INSERT ON monthly_plans
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT NEW.member_id, NEW.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;

--> statement-breakpoint
CREATE TRIGGER monthly_plans_invalidate_plan_review_delete
AFTER DELETE ON monthly_plans
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT OLD.member_id, OLD.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;

--> statement-breakpoint
CREATE TRIGGER monthly_plans_invalidate_plan_review_update
AFTER UPDATE OF member_id, project_id, month, assignment_role, planned_hours ON monthly_plans
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT OLD.member_id, OLD.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT NEW.member_id, NEW.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id) AND (OLD.member_id != NEW.member_id OR OLD.month != NEW.month)
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;

--> statement-breakpoint
CREATE TRIGGER member_monthly_capacities_invalidate_plan_review_insert
AFTER INSERT ON member_monthly_capacities
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT NEW.member_id, NEW.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;

--> statement-breakpoint
CREATE TRIGGER member_monthly_capacities_invalidate_plan_review_delete
AFTER DELETE ON member_monthly_capacities
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT OLD.member_id, OLD.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;

--> statement-breakpoint
CREATE TRIGGER member_monthly_capacities_invalidate_plan_review_update
AFTER UPDATE OF member_id, month, capacity_hours ON member_monthly_capacities
BEGIN
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT OLD.member_id, OLD.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id) 
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
INSERT INTO member_monthly_plan_reviews (member_id, month, revision)
SELECT NEW.member_id, NEW.month, 1 WHERE EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id) AND (OLD.member_id != NEW.member_id OR OLD.month != NEW.month)
ON CONFLICT(member_id, month) DO UPDATE SET revision = revision + 1, confirmed_by_member_id = NULL, confirmed_at = NULL;
END;
