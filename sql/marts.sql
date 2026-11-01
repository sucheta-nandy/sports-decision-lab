-- SQLite marts; all chart rates are recomputed from additive counts/sums.
DROP VIEW IF EXISTS situation_mart;
CREATE VIEW situation_mart AS
SELECT season, posteam AS team, down, distance, field_zone, play_type,
       COUNT(*) AS n, SUM(success) AS successes, SUM(epa) AS epa_sum,
       SUM(epa*epa) AS epa_square_sum, SUM(ydstogo) AS distance_sum
FROM plays GROUP BY season, posteam, down, distance, field_zone, play_type;

DROP VIEW IF EXISTS game_mart;
CREATE VIEW game_mart AS
SELECT season, week, game_id, posteam AS team, defteam AS opponent,
       COUNT(*) AS n, SUM(success) AS successes, SUM(epa) AS epa_sum
FROM plays GROUP BY season, week, game_id, posteam, defteam;
