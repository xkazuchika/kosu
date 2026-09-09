WITH ranked_active_assignments AS (
  SELECT
    `id`,
    FIRST_VALUE(`assigned_at`) OVER (
      PARTITION BY `member_id`, `project_id`
      ORDER BY `assigned_at` DESC, `id` DESC
    ) AS `survivor_assigned_at`,
    ROW_NUMBER() OVER (
      PARTITION BY `member_id`, `project_id`
      ORDER BY `assigned_at` DESC, `id` DESC
    ) AS `active_rank`
  FROM `project_assignments`
  WHERE `removed_at` IS NULL
)
UPDATE `project_assignments`
SET `removed_at` = (
  SELECT `survivor_assigned_at`
  FROM `ranked_active_assignments`
  WHERE `ranked_active_assignments`.`id` = `project_assignments`.`id`
)
WHERE `id` IN (
  SELECT `id`
  FROM `ranked_active_assignments`
  WHERE `active_rank` > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_assignments_active_member_project_unique` ON `project_assignments` (`member_id`,`project_id`) WHERE "project_assignments"."removed_at" IS NULL;
