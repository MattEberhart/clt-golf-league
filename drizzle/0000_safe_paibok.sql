CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `matchups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`team_a_id` integer NOT NULL,
	`team_b_id` integer NOT NULL,
	`slot` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matchups_round_slot_unique` ON `matchups` (`round_id`,`slot`);--> statement-breakpoint
CREATE INDEX `matchups_round_idx` ON `matchups` (`round_id`);--> statement-breakpoint
CREATE TABLE `results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matchup_id` integer NOT NULL,
	`winner_team_id` integer NOT NULL,
	`loser_team_id` integer NOT NULL,
	`mov` integer NOT NULL,
	`submitted_at` text NOT NULL,
	`submitted_by_label` text NOT NULL,
	FOREIGN KEY (`matchup_id`) REFERENCES `matchups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loser_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `results_matchup_unique` ON `results` (`matchup_id`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`course_id` integer,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rounds_number_unique` ON `rounds` (`number`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`player1_name` text NOT NULL,
	`player1_raw_hcp` text NOT NULL,
	`player1_adj_hcp` integer NOT NULL,
	`player2_name` text NOT NULL,
	`player2_raw_hcp` text NOT NULL,
	`player2_adj_hcp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_number_unique` ON `teams` (`number`);