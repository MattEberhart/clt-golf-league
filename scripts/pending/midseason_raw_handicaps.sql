-- NOT A MIGRATION YET. Lives outside drizzle/ so `pnpm db:migrate` cannot pick
-- it up. The mid-season re-rate (Round 4) landed with adjusted handicaps only;
-- raw values are still pending from the commissioner.
--
-- When the numbers arrive: replace each __TODO__, move this file to
-- drizzle/0004_midseason_raw_handicaps.sql, and add a matching entry to
-- drizzle/meta/_journal.json (see 0001 for the hand-written precedent).

UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Thomas Anderson');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Calvin Troung');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Will Francis');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Andrew Alix');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Jay Glenn');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Andrew Adam');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Tyler Young');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Matt Eberhart');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'David Henderson');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Joe Abrahamson');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = 'Ben Berger');
UPDATE `player_handicaps` SET `raw_hcp` = '__TODO__'
 WHERE `effective_from_round` = '4'
   AND `season_id` = (SELECT `id` FROM `seasons` WHERE `year` = 2026)
   AND `player_id` = (SELECT `id` FROM `players` WHERE `name` = '"Slick" Nick Lloyd');
