-- The mid-season re-rate touched every player's raw handicap, including the two
-- whose adjusted number happened to land on the same integer. 0002 has already
-- been applied to production, so these rows arrive as their own migration
-- rather than as an edit to it.
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
	SELECT 'Ben Berger' AS `name`, 0 AS `adj_hcp`
	UNION ALL SELECT '"Slick" Nick Lloyd', 8
) `v`
JOIN `players` `p` ON `p`.`name` = `v`.`name`;
