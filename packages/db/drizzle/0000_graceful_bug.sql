CREATE TABLE `cabinet_appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cabinet_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`post_name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`start_date` text,
	`end_date` text,
	`source_url` text NOT NULL,
	`source_note` text NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cabinet_appointments_cabinet_idx` ON `cabinet_appointments` (`cabinet_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `cabinet_appointments_unique` ON `cabinet_appointments` (`cabinet_id`,`post_name`,`person_id`);--> statement-breakpoint
CREATE TABLE `cabinets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cabinets_name_unique` ON `cabinets` (`name`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kana` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `persons_name_unique` ON `persons` (`name`);