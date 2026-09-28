CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cadence_json` text NOT NULL,
	`last_done_at` text,
	`zone` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE no action
);
