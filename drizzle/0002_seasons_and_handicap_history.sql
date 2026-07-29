CREATE TABLE `player_handicaps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`raw_hcp` text,
	`adj_hcp` integer NOT NULL,
	`effective_from_round` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_hcp_unique` ON `player_handicaps` (`season_id`,`player_id`,`effective_from_round`);--> statement-breakpoint
CREATE INDEX `player_hcp_season_idx` ON `player_handicaps` (`season_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`name` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_year_unique` ON `seasons` (`year`);--> statement-breakpoint
CREATE TABLE `team_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`slot` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_players_team_slot_unique` ON `team_players` (`team_id`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_players_team_player_unique` ON `team_players` (`team_id`,`player_id`);--> statement-breakpoint
ALTER TABLE `rounds` ADD `season_id` integer REFERENCES seasons(id);--> statement-breakpoint
ALTER TABLE `teams` ADD `season_id` integer REFERENCES seasons(id);--> statement-breakpoint
INSERT INTO `seasons` (`year`, `name`, `is_current`) VALUES (2026, '2026 Season', 1);--> statement-breakpoint
UPDATE `teams` SET `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026);--> statement-breakpoint
UPDATE `rounds` SET `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026);--> statement-breakpoint
INSERT INTO `players` (`name`)
SELECT `name` FROM (
	SELECT `number` AS `n`, 1 AS `slot`, `player1_name` AS `name` FROM `teams`
	UNION ALL
	SELECT `number` AS `n`, 2 AS `slot`, `player2_name` AS `name` FROM `teams`
) ORDER BY `n`, `slot`;--> statement-breakpoint
INSERT INTO `team_players` (`team_id`, `player_id`, `slot`)
SELECT `t`.`id`, `p`.`id`, 1 FROM `teams` `t` JOIN `players` `p` ON `p`.`name` = `t`.`player1_name`;--> statement-breakpoint
INSERT INTO `team_players` (`team_id`, `player_id`, `slot`)
SELECT `t`.`id`, `p`.`id`, 2 FROM `teams` `t` JOIN `players` `p` ON `p`.`name` = `t`.`player2_name`;--> statement-breakpoint
INSERT INTO `player_handicaps` (`season_id`, `player_id`, `raw_hcp`, `adj_hcp`, `effective_from_round`, `created_at`)
SELECT `t`.`season_id`, `p`.`id`, `t`.`player1_raw_hcp`, `t`.`player1_adj_hcp`, '1', '2026-04-01T00:00:00.000Z'
FROM `teams` `t` JOIN `players` `p` ON `p`.`name` = `t`.`player1_name`;--> statement-breakpoint
INSERT INTO `player_handicaps` (`season_id`, `player_id`, `raw_hcp`, `adj_hcp`, `effective_from_round`, `created_at`)
SELECT `t`.`season_id`, `p`.`id`, `t`.`player2_raw_hcp`, `t`.`player2_adj_hcp`, '1', '2026-04-01T00:00:00.000Z'
FROM `teams` `t` JOIN `players` `p` ON `p`.`name` = `t`.`player2_name`;--> statement-breakpoint
INSERT INTO `player_handicaps` (`season_id`, `player_id`, `raw_hcp`, `adj_hcp`, `effective_from_round`, `note`, `created_at`)
SELECT
	(SELECT `id` FROM `seasons` WHERE `year` = 2026),
	`p`.`id`,
	NULL,
	`v`.`adj_hcp`,
	'4',
	'Mid-season re-rate',
	'2026-07-15T00:00:00.000Z'
FROM (
	SELECT 'Thomas Anderson' AS `name`, 21 AS `adj_hcp`
	UNION ALL SELECT 'Calvin Troung', 24
	UNION ALL SELECT 'Will Francis', 8
	UNION ALL SELECT 'Andrew Alix', 25
	UNION ALL SELECT 'Jay Glenn', 15
	UNION ALL SELECT 'Andrew Adam', 11
	UNION ALL SELECT 'Tyler Young', 7
	UNION ALL SELECT 'Matt Eberhart', 16
	UNION ALL SELECT 'David Henderson', 23
	UNION ALL SELECT 'Joe Abrahamson', 19
) `v`
JOIN `players` `p` ON `p`.`name` = `v`.`name`;
