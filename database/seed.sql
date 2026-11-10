-- =====================================================================================================
-- BOOK_MY_SEAT - Phase 4 seed data
-- Target: MySQL Server 8.0.44 (needs 8.0.19 or newer), database: book_my_seat
-- Run AFTER database/schema.sql. It does not drop or recreate any real table or the database.
--
-- WHAT IT LOADS (all taken from the application's own sample data)
--   9 movies, 10 genres, 18 movie-genre links, 3 cinemas, 19 screens, 1520 seats (8 rows A-H x 10 seats per screen),
--   270 shows (5 days from the day you run it) and 810 show prices (Standard / Premium / Recliner for every show).
--
-- CAN IT BE RE-RUN?  Yes. It never creates duplicates:
--   * movies, genres, links, cinemas   -> "insert, or update the existing row with the same id".
--   * screens, seats, show prices      -> "insert what is missing, then correct what differs".
--   * shows                            -> the demo shows (identified by their fixed ids) that have NO bookings are
--                                         removed and created again, starting from today. See "HOW SHOWS WORK".
--
-- HOW SHOWS WORK (the application builds its shows relative to today, so a fixed date would go stale)
--   * Show ids keep the application's convention:  movie*1000 + day*100 + cinema_choice*10 + time_slot
--     (for example 3204 = movie 3, day +2, 2nd cinema choice, 5th time slot).  "day" is 0 (today) to 4.
--   * Dates are worked out when the script runs, as: today's date in India (UTC+5:30) + day offset.
--     Time slots (India time): 10:30, 13:45, 17:00, 20:15, 22:45.
--   * start_time is stored in UTC (decision from Phase 1), e.g. 10:30 India time is stored as 05:00.
--     A fixed +05:30 offset is used instead of CONVERT_TZ because MySQL on Windows often has no time-zone tables.
--   * Shows that have already started when the script runs are stored with status COMPLETED, the rest SCHEDULED.
--     The application must still filter by start_time (it already does), because time keeps moving after seeding.
--   * Re-run this script on a later day to move the 5-day window forward.
--   * Shows that already have bookings are never deleted or moved (relevant from Phase 6 onwards). If such a kept
--     show happens to occupy a screen at the same time as a new show, the new show is skipped (so the total can then
--     be a little below 270). Before Phase 6 there are no bookings, so you always get all 270.
--
-- SCREENS (a decision to review)
--   The application's sample data labelled only "Screen 1-3" per cinema, but it schedules up to 6 shows at the same
--   cinema at the same moment, which is impossible on 3 screens and would break the schema's rule UNIQUE(screen_id,
--   start_time). Each show is therefore given the lowest-numbered screen that is free (a screen is free again 15 minutes
--   after its movie ends). That needs 6 screens at Aurora, 7 at Lotus and 6 at Starline.
--   Screen ids follow the application's convention: cinema id * 10 + screen number (11..16, 21..27, 31..36).
--
-- SEATS
--   Rows A-C STANDARD, D-F PREMIUM, G-H RECLINER (same as the seat selection page). Seat id = screen id * 100 +
--   (row index * 10 + seat number), e.g. screen 11, seat A1 = 1101, seat H10 = 1180. The seat page's own numbers 1-80
--   are therefore the last two digits of the seat id (80 -> ...80). The central aisle (after seat 5) is a UI detail.
--
-- IF SOMETHING FAILS HALF-WAY
--   The data load runs inside one transaction. If MySQL Workbench stops with an error, run:  ROLLBACK;
--   and fix the problem before running the script again.
-- =====================================================================================================

USE book_my_seat;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- MySQL Workbench enables "safe updates" by default; the UPDATE statements below are keyed and bounded, but the
-- setting is switched off for this session only and restored at the end.
SET @old_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

-- ---------------------------------------------------------------------------------------------------
-- 1. MOVIES (ids 1-9 as in the application)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO movies (id, title, description, language, duration_min, certificate, release_date, poster_url, is_active)
VALUES
  (1, 'Midnight Monsoon', 'Two strangers sharing a stalled Mumbai local during a night of record rain discover they are connected by a letter neither of them sent.', 'Hindi', 138, 'UA', '2026-10-09', NULL, 1),
  (2, 'The Last Local', 'A night-shift ticket checker notices the same passenger on every final train and slowly realises the man is running from something much bigger than the law.', 'Hindi', 124, 'UA', '2026-10-16', NULL, 1),
  (3, 'Rang De Raat', 'A retired stunt double is pulled back into the city''s underground racing scene when his old crew goes missing during Holi week.', 'Hindi', 151, 'UA', '2026-10-23', NULL, 1),
  (4, 'Chai & Chaos', 'Three generations of a Lucknow family try to keep their tea stall open while a wedding, a rival cafe and a runaway goat all collide on one Sunday.', 'Hindi', 132, 'U', '2026-10-02', NULL, 1),
  (5, 'Echoes of Kutch', 'A young cartographer crosses the white salt desert to find the village her grandmother never stopped talking about.', 'Hindi', 128, 'U', '2026-09-25', NULL, 1),
  (6, 'Kaveri Express', 'A school teacher and a retired engine driver race to deliver a village''s harvest on a decommissioned train before the monsoon floods the tracks.', 'Tamil', 143, 'UA', '2026-10-18', NULL, 1),
  (7, 'Dilli Heist', 'Five very unqualified friends plan to rob a Chandni Chowk jewellery auction, mostly to settle an argument about who is the cleverest.', 'Hindi', 127, 'UA', '2026-10-11', NULL, 1),
  (8, 'Shadow of the Haveli', 'A heritage-hotel inspector spends one night in a crumbling Rajasthan haveli and finds that its guest register keeps adding names.', 'Hindi', 118, 'A', '2026-10-25', NULL, 1),
  (9, 'Skyline Protocol', 'When a city''s traffic AI begins rerouting people on purpose, a night-shift engineer has six hours to find out who taught it to do that.', 'English', 112, 'UA', '2026-10-20', NULL, 1)
AS new
ON DUPLICATE KEY UPDATE
  title = new.title, description = new.description, language = new.language, duration_min = new.duration_min,
  certificate = new.certificate, release_date = new.release_date, poster_url = new.poster_url, is_active = new.is_active;

-- ---------------------------------------------------------------------------------------------------
-- 2. GENRES (ids in alphabetical order)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO genres (id, name)
VALUES
  (1, 'Action'),
  (2, 'Adventure'),
  (3, 'Comedy'),
  (4, 'Drama'),
  (5, 'Family'),
  (6, 'Horror'),
  (7, 'Mystery'),
  (8, 'Romance'),
  (9, 'Sci-Fi'),
  (10, 'Thriller')
AS new
ON DUPLICATE KEY UPDATE name = new.name;

-- ---------------------------------------------------------------------------------------------------
-- 3. MOVIE_GENRES (which genres each movie has)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO movie_genres (movie_id, genre_id)
VALUES
  (1, 4),  -- Midnight Monsoon: Drama,
  (1, 8),  -- Midnight Monsoon: Romance,
  (2, 10),  -- The Last Local: Thriller,
  (2, 4),  -- The Last Local: Drama,
  (3, 1),  -- Rang De Raat: Action,
  (3, 10),  -- Rang De Raat: Thriller,
  (4, 3),  -- Chai & Chaos: Comedy,
  (4, 5),  -- Chai & Chaos: Family,
  (5, 4),  -- Echoes of Kutch: Drama,
  (5, 2),  -- Echoes of Kutch: Adventure,
  (6, 2),  -- Kaveri Express: Adventure,
  (6, 4),  -- Kaveri Express: Drama,
  (7, 3),  -- Dilli Heist: Comedy,
  (7, 10),  -- Dilli Heist: Thriller,
  (8, 6),  -- Shadow of the Haveli: Horror,
  (8, 7),  -- Shadow of the Haveli: Mystery,
  (9, 9),  -- Skyline Protocol: Sci-Fi,
  (9, 1)  -- Skyline Protocol: Action
AS new
ON DUPLICATE KEY UPDATE genre_id = new.genre_id;

-- ---------------------------------------------------------------------------------------------------
-- 4. CINEMAS (ids 1-3)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO cinemas (id, name, city, address)
VALUES
  (1, 'Aurora Cinemas', 'New Delhi', 'District Centre, Saket'),
  (2, 'Lotus Multiplex', 'New Delhi', 'Barakhamba Road, Connaught Place'),
  (3, 'Starline Screens', 'New Delhi', 'Sector 12, Dwarka')
AS new
ON DUPLICATE KEY UPDATE name = new.name, city = new.city, address = new.address;

-- ---------------------------------------------------------------------------------------------------
-- Work tables for the next steps (TEMPORARY = they exist only in this session and vanish when it ends;
-- they are never visible to other sessions and are not part of your database).
-- ---------------------------------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_seed_screens;
DROP TEMPORARY TABLE IF EXISTS tmp_seat_layout;
DROP TEMPORARY TABLE IF EXISTS tmp_cinema_prices;
DROP TEMPORARY TABLE IF EXISTS tmp_show_plan;

CREATE TEMPORARY TABLE tmp_seed_screens (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  cinema_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE tmp_seat_layout (
  row_idx TINYINT UNSIGNED NOT NULL,
  row_label VARCHAR(5) NOT NULL,
  seat_number SMALLINT UNSIGNED NOT NULL,
  category ENUM('STANDARD', 'PREMIUM', 'RECLINER') NOT NULL,
  PRIMARY KEY (row_idx, seat_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE tmp_cinema_prices (
  cinema_id BIGINT UNSIGNED NOT NULL,
  category ENUM('STANDARD', 'PREMIUM', 'RECLINER') NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (cinema_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TEMPORARY TABLE tmp_show_plan (
  show_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  movie_id BIGINT UNSIGNED NOT NULL,
  screen_id BIGINT UNSIGNED NOT NULL,
  day_offset TINYINT UNSIGNED NOT NULL,      -- 0 = today (India), 4 = four days from today
  slot_minutes SMALLINT UNSIGNED NOT NULL    -- start time in India time, as minutes after midnight (630 = 10:30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_seed_screens (id, cinema_id, name) VALUES
  (11, 1, 'Screen 1'),
  (12, 1, 'Screen 2'),
  (13, 1, 'Screen 3'),
  (14, 1, 'Screen 4'),
  (15, 1, 'Screen 5'),
  (16, 1, 'Screen 6'),
  (21, 2, 'Screen 1'),
  (22, 2, 'Screen 2'),
  (23, 2, 'Screen 3'),
  (24, 2, 'Screen 4'),
  (25, 2, 'Screen 5'),
  (26, 2, 'Screen 6'),
  (27, 2, 'Screen 7'),
  (31, 3, 'Screen 1'),
  (32, 3, 'Screen 2'),
  (33, 3, 'Screen 3'),
  (34, 3, 'Screen 4'),
  (35, 3, 'Screen 5'),
  (36, 3, 'Screen 6');

INSERT INTO tmp_cinema_prices (cinema_id, category, price) VALUES
  (2, 'STANDARD', 260.00),
  (2, 'PREMIUM', 380.00),
  (2, 'RECLINER', 620.00),
  (3, 'STANDARD', 200.00),
  (3, 'PREMIUM', 290.00),
  (3, 'RECLINER', 470.00),
  (1, 'STANDARD', 220.00),
  (1, 'PREMIUM', 320.00),
  (1, 'RECLINER', 520.00);

-- 8 rows (A-H) x 10 seats. Category by row: A-C STANDARD, D-F PREMIUM, G-H RECLINER.
INSERT INTO tmp_seat_layout (row_idx, row_label, seat_number, category)
SELECT r.row_idx, r.row_label, n.seat_number, r.category
FROM (
  SELECT 0 AS row_idx, 'A' AS row_label, 'STANDARD' AS category UNION ALL
  SELECT 1, 'B', 'STANDARD' UNION ALL SELECT 2, 'C', 'STANDARD' UNION ALL
  SELECT 3, 'D', 'PREMIUM'  UNION ALL SELECT 4, 'E', 'PREMIUM'  UNION ALL SELECT 5, 'F', 'PREMIUM' UNION ALL
  SELECT 6, 'G', 'RECLINER' UNION ALL SELECT 7, 'H', 'RECLINER'
) AS r
CROSS JOIN (
  SELECT 1 AS seat_number UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL
  SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) AS n;

-- Show plan: one row per show: (show id, movie, screen, day offset, start slot). Screens were assigned by the rule above.
INSERT INTO tmp_show_plan (show_id, movie_id, screen_id, day_offset, slot_minutes) VALUES
  (1000, 1, 21, 0, 630),
  (1001, 1, 21, 0, 825),
  (1003, 1, 21, 0, 1215),
  (1011, 1, 31, 0, 825),
  (1012, 1, 31, 0, 1020),
  (1014, 1, 31, 0, 1365),
  (1101, 1, 31, 1, 825),
  (1102, 1, 31, 1, 1020),
  (1104, 1, 32, 1, 1365),
  (1110, 1, 11, 1, 630),
  (1112, 1, 11, 1, 1020),
  (1113, 1, 11, 1, 1215),
  (1200, 1, 11, 2, 630),
  (1202, 1, 11, 2, 1020),
  (1203, 1, 11, 2, 1215),
  (1211, 1, 21, 2, 825),
  (1213, 1, 21, 2, 1215),
  (1214, 1, 22, 2, 1365),
  (1301, 1, 21, 3, 825),
  (1303, 1, 21, 3, 1215),
  (1304, 1, 22, 3, 1365),
  (1310, 1, 31, 3, 630),
  (1312, 1, 31, 3, 1020),
  (1314, 1, 31, 3, 1365),
  (1400, 1, 31, 4, 630),
  (1402, 1, 31, 4, 1020),
  (1404, 1, 32, 4, 1365),
  (1410, 1, 11, 4, 630),
  (1411, 1, 11, 4, 825),
  (1413, 1, 11, 4, 1215),
  (2001, 2, 32, 0, 825),
  (2002, 2, 32, 0, 1020),
  (2004, 2, 32, 0, 1365),
  (2010, 2, 11, 0, 630),
  (2012, 2, 11, 0, 1020),
  (2013, 2, 11, 0, 1215),
  (2100, 2, 12, 1, 630),
  (2102, 2, 12, 1, 1020),
  (2103, 2, 12, 1, 1215),
  (2111, 2, 21, 1, 825),
  (2113, 2, 21, 1, 1215),
  (2114, 2, 21, 1, 1365),
  (2201, 2, 22, 2, 825),
  (2203, 2, 22, 2, 1215),
  (2204, 2, 23, 2, 1365),
  (2210, 2, 31, 2, 630),
  (2212, 2, 31, 2, 1020),
  (2214, 2, 31, 2, 1365),
  (2300, 2, 32, 3, 630),
  (2302, 2, 32, 3, 1020),
  (2304, 2, 32, 3, 1365),
  (2310, 2, 11, 3, 630),
  (2311, 2, 11, 3, 825),
  (2313, 2, 11, 3, 1215),
  (2400, 2, 12, 4, 630),
  (2401, 2, 12, 4, 825),
  (2403, 2, 12, 4, 1215),
  (2411, 2, 21, 4, 825),
  (2412, 2, 21, 4, 1020),
  (2414, 2, 21, 4, 1365),
  (3000, 3, 12, 0, 630),
  (3002, 3, 12, 0, 1020),
  (3003, 3, 12, 0, 1215),
  (3011, 3, 22, 0, 825),
  (3013, 3, 22, 0, 1215),
  (3014, 3, 23, 0, 1365),
  (3101, 3, 22, 1, 825),
  (3103, 3, 22, 1, 1215),
  (3104, 3, 23, 1, 1365),
  (3110, 3, 31, 1, 630),
  (3112, 3, 32, 1, 1020),
  (3114, 3, 33, 1, 1365),
  (3200, 3, 32, 2, 630),
  (3202, 3, 32, 2, 1020),
  (3204, 3, 33, 2, 1365),
  (3210, 3, 12, 2, 630),
  (3211, 3, 11, 2, 825),
  (3213, 3, 12, 2, 1215),
  (3300, 3, 12, 3, 630),
  (3301, 3, 12, 3, 825),
  (3303, 3, 12, 3, 1215),
  (3311, 3, 22, 3, 825),
  (3312, 3, 21, 3, 1020),
  (3314, 3, 23, 3, 1365),
  (3401, 3, 22, 4, 825),
  (3402, 3, 22, 4, 1020),
  (3404, 3, 22, 4, 1365),
  (3410, 3, 32, 4, 630),
  (3412, 3, 32, 4, 1020),
  (3413, 3, 31, 4, 1215),
  (4001, 4, 23, 0, 825),
  (4003, 4, 23, 0, 1215),
  (4004, 4, 24, 0, 1365),
  (4010, 4, 31, 0, 630),
  (4012, 4, 33, 0, 1020),
  (4014, 4, 33, 0, 1365),
  (4100, 4, 32, 1, 630),
  (4102, 4, 33, 1, 1020),
  (4104, 4, 34, 1, 1365),
  (4110, 4, 13, 1, 630),
  (4111, 4, 11, 1, 825),
  (4113, 4, 13, 1, 1215),
  (4200, 4, 13, 2, 630),
  (4201, 4, 12, 2, 825),
  (4203, 4, 13, 2, 1215),
  (4211, 4, 23, 2, 825),
  (4212, 4, 21, 2, 1020),
  (4214, 4, 24, 2, 1365),
  (4301, 4, 23, 3, 825),
  (4302, 4, 22, 3, 1020),
  (4304, 4, 24, 3, 1365),
  (4310, 4, 33, 3, 630),
  (4312, 4, 33, 3, 1020),
  (4313, 4, 31, 3, 1215),
  (4400, 4, 33, 4, 630),
  (4402, 4, 33, 4, 1020),
  (4403, 4, 32, 4, 1215),
  (4411, 4, 13, 4, 825),
  (4413, 4, 13, 4, 1215),
  (4414, 4, 12, 4, 1365),
  (5000, 5, 32, 0, 630),
  (5002, 5, 34, 0, 1020),
  (5004, 5, 34, 0, 1365),
  (5010, 5, 13, 0, 630),
  (5011, 5, 11, 0, 825),
  (5013, 5, 13, 0, 1215),
  (5100, 5, 14, 1, 630),
  (5101, 5, 12, 1, 825),
  (5103, 5, 14, 1, 1215),
  (5111, 5, 23, 1, 825),
  (5112, 5, 21, 1, 1020),
  (5114, 5, 24, 1, 1365),
  (5201, 5, 24, 2, 825),
  (5202, 5, 22, 2, 1020),
  (5204, 5, 25, 2, 1365),
  (5210, 5, 33, 2, 630),
  (5212, 5, 33, 2, 1020),
  (5213, 5, 31, 2, 1215),
  (5300, 5, 34, 3, 630),
  (5302, 5, 34, 3, 1020),
  (5303, 5, 32, 3, 1215),
  (5311, 5, 13, 3, 825),
  (5313, 5, 13, 3, 1215),
  (5314, 5, 11, 3, 1365),
  (5401, 5, 14, 4, 825),
  (5403, 5, 14, 4, 1215),
  (5404, 5, 13, 4, 1365),
  (5410, 5, 21, 4, 630),
  (5412, 5, 23, 4, 1020),
  (5414, 5, 23, 4, 1365),
  (6000, 6, 14, 0, 630),
  (6001, 6, 12, 0, 825),
  (6003, 6, 14, 0, 1215),
  (6011, 6, 24, 0, 825),
  (6012, 6, 21, 0, 1020),
  (6014, 6, 25, 0, 1365),
  (6101, 6, 24, 1, 825),
  (6102, 6, 22, 1, 1020),
  (6104, 6, 25, 1, 1365),
  (6110, 6, 33, 1, 630),
  (6112, 6, 34, 1, 1020),
  (6113, 6, 31, 1, 1215),
  (6200, 6, 34, 2, 630),
  (6202, 6, 34, 2, 1020),
  (6203, 6, 32, 2, 1215),
  (6211, 6, 13, 2, 825),
  (6213, 6, 14, 2, 1215),
  (6214, 6, 13, 2, 1365),
  (6301, 6, 14, 3, 825),
  (6303, 6, 14, 3, 1215),
  (6304, 6, 13, 3, 1365),
  (6310, 6, 21, 3, 630),
  (6312, 6, 23, 3, 1020),
  (6314, 6, 25, 3, 1365),
  (6400, 6, 22, 4, 630),
  (6402, 6, 24, 4, 1020),
  (6404, 6, 24, 4, 1365),
  (6410, 6, 34, 4, 630),
  (6411, 6, 31, 4, 825),
  (6413, 6, 33, 4, 1215),
  (7001, 7, 25, 0, 825),
  (7002, 7, 22, 0, 1020),
  (7004, 7, 26, 0, 1365),
  (7010, 7, 33, 0, 630),
  (7012, 7, 35, 0, 1020),
  (7013, 7, 31, 0, 1215),
  (7100, 7, 34, 1, 630),
  (7102, 7, 35, 1, 1020),
  (7103, 7, 32, 1, 1215),
  (7111, 7, 13, 1, 825),
  (7113, 7, 15, 1, 1215),
  (7114, 7, 12, 1, 1365),
  (7201, 7, 14, 2, 825),
  (7203, 7, 15, 2, 1215),
  (7204, 7, 15, 2, 1365),
  (7210, 7, 21, 2, 630),
  (7212, 7, 23, 2, 1020),
  (7214, 7, 26, 2, 1365),
  (7300, 7, 22, 3, 630),
  (7302, 7, 24, 3, 1020),
  (7304, 7, 26, 3, 1365),
  (7310, 7, 35, 3, 630),
  (7311, 7, 31, 3, 825),
  (7313, 7, 33, 3, 1215),
  (7400, 7, 35, 4, 630),
  (7401, 7, 32, 4, 825),
  (7403, 7, 34, 4, 1215),
  (7411, 7, 15, 4, 825),
  (7412, 7, 11, 4, 1020),
  (7414, 7, 14, 4, 1365),
  (8000, 8, 34, 0, 630),
  (8002, 8, 36, 0, 1020),
  (8003, 8, 32, 0, 1215),
  (8011, 8, 13, 0, 825),
  (8013, 8, 15, 0, 1215),
  (8014, 8, 11, 0, 1365),
  (8101, 8, 14, 1, 825),
  (8103, 8, 16, 1, 1215),
  (8104, 8, 13, 1, 1365),
  (8110, 8, 21, 1, 630),
  (8112, 8, 23, 1, 1020),
  (8114, 8, 26, 1, 1365),
  (8200, 8, 22, 2, 630),
  (8202, 8, 24, 2, 1020),
  (8204, 8, 27, 2, 1365),
  (8210, 8, 35, 2, 630),
  (8211, 8, 31, 2, 825),
  (8213, 8, 33, 2, 1215),
  (8300, 8, 36, 3, 630),
  (8301, 8, 32, 3, 825),
  (8303, 8, 34, 3, 1215),
  (8311, 8, 15, 3, 825),
  (8312, 8, 11, 3, 1020),
  (8314, 8, 15, 3, 1365),
  (8401, 8, 16, 4, 825),
  (8402, 8, 12, 4, 1020),
  (8404, 8, 15, 4, 1365),
  (8410, 8, 23, 4, 630),
  (8412, 8, 25, 4, 1020),
  (8413, 8, 21, 4, 1215),
  (9001, 9, 14, 0, 825),
  (9003, 9, 16, 0, 1215),
  (9004, 9, 13, 0, 1365),
  (9010, 9, 22, 0, 630),
  (9012, 9, 23, 0, 1020),
  (9014, 9, 27, 0, 1365),
  (9100, 9, 22, 1, 630),
  (9102, 9, 24, 1, 1020),
  (9104, 9, 27, 1, 1365),
  (9110, 9, 35, 1, 630),
  (9111, 9, 32, 1, 825),
  (9113, 9, 33, 1, 1215),
  (9200, 9, 36, 2, 630),
  (9201, 9, 32, 2, 825),
  (9203, 9, 34, 2, 1215),
  (9211, 9, 15, 2, 825),
  (9212, 9, 12, 2, 1020),
  (9214, 9, 16, 2, 1365),
  (9301, 9, 16, 3, 825),
  (9302, 9, 12, 3, 1020),
  (9304, 9, 16, 3, 1365),
  (9310, 9, 23, 3, 630),
  (9312, 9, 25, 3, 1020),
  (9313, 9, 22, 3, 1215),
  (9400, 9, 24, 4, 630),
  (9402, 9, 26, 4, 1020),
  (9403, 9, 22, 4, 1215),
  (9411, 9, 33, 4, 825),
  (9413, 9, 35, 4, 1215),
  (9414, 9, 34, 4, 1365);

-- ---------------------------------------------------------------------------------------------------
-- 5. SCREENS
-- ---------------------------------------------------------------------------------------------------
INSERT INTO screens (id, cinema_id, name)
SELECT t.id, t.cinema_id, t.name
FROM tmp_seed_screens t
WHERE NOT EXISTS (SELECT 1 FROM screens s WHERE s.id = t.id);

UPDATE screens s
JOIN tmp_seed_screens t ON t.id = s.id
SET s.cinema_id = t.cinema_id, s.name = t.name
WHERE s.cinema_id <> t.cinema_id OR s.name <> t.name;

-- ---------------------------------------------------------------------------------------------------
-- 6. SEATS (80 per seeded screen)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO seats (id, screen_id, row_label, seat_number, category)
SELECT sc.id * 100 + l.row_idx * 10 + l.seat_number, sc.id, l.row_label, l.seat_number, l.category
FROM screens sc
JOIN tmp_seed_screens ss ON ss.id = sc.id
CROSS JOIN tmp_seat_layout l
WHERE NOT EXISTS (SELECT 1 FROM seats x WHERE x.id = sc.id * 100 + l.row_idx * 10 + l.seat_number);

UPDATE seats x
JOIN screens sc ON sc.id = x.screen_id
JOIN tmp_seed_screens ss ON ss.id = sc.id
JOIN tmp_seat_layout l ON x.id = sc.id * 100 + l.row_idx * 10 + l.seat_number
SET x.category = l.category
WHERE x.category <> l.category;

-- ---------------------------------------------------------------------------------------------------
-- 7. SHOWS (5 days starting today, India date; start_time is stored in UTC)
-- ---------------------------------------------------------------------------------------------------
SET @ist_today = DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE);

-- Remove the demo shows that nobody has booked, so the window can move forward without unique-key clashes.
-- (Their show_prices rows are removed automatically by the foreign key's ON DELETE CASCADE.)
DELETE FROM shows
WHERE id IN (SELECT show_id FROM tmp_show_plan)
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.show_id = shows.id);

INSERT INTO shows (id, movie_id, screen_id, start_time, status)
SELECT x.show_id, x.movie_id, x.screen_id, x.start_utc,
       IF(x.start_utc <= UTC_TIMESTAMP(), 'COMPLETED', 'SCHEDULED')
FROM (
  SELECT p.show_id, p.movie_id, p.screen_id,
         DATE_ADD(DATE_ADD(@ist_today, INTERVAL p.day_offset DAY), INTERVAL (p.slot_minutes - 330) MINUTE) AS start_utc
  FROM tmp_show_plan p
) AS x
WHERE NOT EXISTS (SELECT 1 FROM shows s WHERE s.id = x.show_id)
  -- also skip a show whose screen is already taken at that exact time by a kept (booked) show,
  -- so a re-run can never fail on the schema's UNIQUE(screen_id, start_time) rule
  AND NOT EXISTS (SELECT 1 FROM shows t WHERE t.screen_id = x.screen_id AND t.start_time = x.start_utc);

-- ---------------------------------------------------------------------------------------------------
-- 8. SHOW_PRICES (cinema-specific: Aurora 220/320/520, Lotus 260/380/620, Starline 200/290/470)
-- ---------------------------------------------------------------------------------------------------
INSERT INTO show_prices (show_id, category, price)
SELECT s.id, cp.category, cp.price
FROM shows s
JOIN tmp_show_plan p ON p.show_id = s.id
JOIN screens sc ON sc.id = s.screen_id
JOIN tmp_cinema_prices cp ON cp.cinema_id = sc.cinema_id
WHERE NOT EXISTS (SELECT 1 FROM show_prices x WHERE x.show_id = s.id AND x.category = cp.category);

UPDATE show_prices sp
JOIN shows s ON s.id = sp.show_id
JOIN tmp_show_plan p ON p.show_id = s.id
JOIN screens sc ON sc.id = s.screen_id
JOIN tmp_cinema_prices cp ON cp.cinema_id = sc.cinema_id AND cp.category = sp.category
SET sp.price = cp.price
WHERE sp.price <> cp.price;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_seed_screens;
DROP TEMPORARY TABLE IF EXISTS tmp_seat_layout;
DROP TEMPORARY TABLE IF EXISTS tmp_cinema_prices;
DROP TEMPORARY TABLE IF EXISTS tmp_show_plan;

SET SQL_SAFE_UPDATES = @old_sql_safe_updates;

-- Quick summary (expected: movies 9, genres 10, movie_genres 18, cinemas 3, screens 19, seats 1520, shows 270, show_prices 810).
-- Full checks are in database/verify_seed.sql.
SELECT 'movies' AS table_name, COUNT(*) AS row_count FROM movies
UNION ALL SELECT 'genres', COUNT(*) FROM genres
UNION ALL SELECT 'movie_genres', COUNT(*) FROM movie_genres
UNION ALL SELECT 'cinemas', COUNT(*) FROM cinemas
UNION ALL SELECT 'screens', COUNT(*) FROM screens
UNION ALL SELECT 'seats', COUNT(*) FROM seats
UNION ALL SELECT 'shows', COUNT(*) FROM shows
UNION ALL SELECT 'show_prices', COUNT(*) FROM show_prices;
