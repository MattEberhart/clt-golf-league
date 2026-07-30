CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_started_at_ms` integer NOT NULL,
	`locked_until_ms` integer DEFAULT 0 NOT NULL
);
