CREATE TABLE `nutrition_entries` (
  `user_id` text NOT NULL,
  `day` text NOT NULL,
  `id` text NOT NULL,
  `entry` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `nutrition_entries_user_day` ON `nutrition_entries` (`user_id`, `day`);
