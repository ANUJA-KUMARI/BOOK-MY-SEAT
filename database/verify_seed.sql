-- =====================================================================================================
-- BOOK_MY_SEAT - Phase 4: verification of database/seed.sql
-- READ-ONLY: this file only runs SELECT statements. It changes nothing.
-- Run it in MySQL Workbench after seed.sql. Result 1 should show PASS on every row.
-- It is written for a freshly seeded database WITHOUT bookings (the situation during Phase 4). Once real bookings
-- exist (Phase 6), seed.sql deliberately keeps booked shows where they are, so a few exact counts (checks 07, 08, 31, 32,
-- 34) can then differ by design; that is not an error.
-- =====================================================================================================
USE book_my_seat;

-- ---------------------------------------------------------------------------------------------------
-- RESULT 1: automatic checks (every row must say PASS)
-- ---------------------------------------------------------------------------------------------------
SELECT check_name, actual, expected, IF(actual = expected, 'PASS', 'FAIL') AS result
FROM (
  -- a) how many rows each table holds
  SELECT '01 movies' AS check_name, (SELECT COUNT(*) FROM movies) AS actual, 9 AS expected
  UNION ALL SELECT '02 genres',       (SELECT COUNT(*) FROM genres), 10
  UNION ALL SELECT '03 movie_genres', (SELECT COUNT(*) FROM movie_genres), 18
  UNION ALL SELECT '04 cinemas',      (SELECT COUNT(*) FROM cinemas), 3
  UNION ALL SELECT '05 screens',      (SELECT COUNT(*) FROM screens), 19
  UNION ALL SELECT '06 seats',        (SELECT COUNT(*) FROM seats), 1520
  UNION ALL SELECT '07 shows',        (SELECT COUNT(*) FROM shows), 270
  UNION ALL SELECT '08 show_prices',  (SELECT COUNT(*) FROM show_prices), 810

  -- b) every foreign key points at a real record (the database already enforces this; this proves it)
  UNION ALL SELECT '10 movie_genres without a movie', (SELECT COUNT(*) FROM movie_genres mg LEFT JOIN movies m ON m.id = mg.movie_id WHERE m.id IS NULL), 0
  UNION ALL SELECT '11 movie_genres without a genre', (SELECT COUNT(*) FROM movie_genres mg LEFT JOIN genres g ON g.id = mg.genre_id WHERE g.id IS NULL), 0
  UNION ALL SELECT '12 screens without a cinema',     (SELECT COUNT(*) FROM screens s LEFT JOIN cinemas c ON c.id = s.cinema_id WHERE c.id IS NULL), 0
  UNION ALL SELECT '13 seats without a screen',       (SELECT COUNT(*) FROM seats s LEFT JOIN screens sc ON sc.id = s.screen_id WHERE sc.id IS NULL), 0
  UNION ALL SELECT '14 shows without a movie',        (SELECT COUNT(*) FROM shows s LEFT JOIN movies m ON m.id = s.movie_id WHERE m.id IS NULL), 0
  UNION ALL SELECT '15 shows without a screen',       (SELECT COUNT(*) FROM shows s LEFT JOIN screens sc ON sc.id = s.screen_id WHERE sc.id IS NULL), 0
  UNION ALL SELECT '16 show_prices without a show',   (SELECT COUNT(*) FROM show_prices sp LEFT JOIN shows s ON s.id = sp.show_id WHERE s.id IS NULL), 0

  -- c) screens and seats
  UNION ALL SELECT '20 screens at Aurora (cinema 1)',   (SELECT COUNT(*) FROM screens WHERE cinema_id = 1), 6
  UNION ALL SELECT '21 screens at Lotus (cinema 2)',    (SELECT COUNT(*) FROM screens WHERE cinema_id = 2), 7
  UNION ALL SELECT '22 screens at Starline (cinema 3)', (SELECT COUNT(*) FROM screens WHERE cinema_id = 3), 6
  UNION ALL SELECT '23 screens that do not have exactly 80 seats',
         (SELECT COUNT(*) FROM (SELECT sc.id FROM screens sc LEFT JOIN seats s ON s.screen_id = sc.id GROUP BY sc.id HAVING COUNT(s.id) <> 80) x), 0
  UNION ALL SELECT '24 seats outside rows A-H / numbers 1-10',
         (SELECT COUNT(*) FROM seats WHERE row_label NOT IN ('A','B','C','D','E','F','G','H') OR seat_number NOT BETWEEN 1 AND 10), 0
  UNION ALL SELECT '25 STANDARD seats (rows A-C, 19 screens x 30)',  (SELECT COUNT(*) FROM seats WHERE category = 'STANDARD' AND row_label IN ('A','B','C')), 570
  UNION ALL SELECT '26 PREMIUM seats (rows D-F, 19 screens x 30)',   (SELECT COUNT(*) FROM seats WHERE category = 'PREMIUM'  AND row_label IN ('D','E','F')), 570
  UNION ALL SELECT '27 RECLINER seats (rows G-H, 19 screens x 20)',  (SELECT COUNT(*) FROM seats WHERE category = 'RECLINER' AND row_label IN ('G','H')), 380
  UNION ALL SELECT '28 seats whose category does not match their row',
         (SELECT COUNT(*) FROM seats WHERE category <> CASE WHEN row_label IN ('A','B','C') THEN 'STANDARD' WHEN row_label IN ('D','E','F') THEN 'PREMIUM' ELSE 'RECLINER' END), 0
  UNION ALL SELECT '29 seat ids that break the convention (screen*100 + row index*10 + number)',
         (SELECT COUNT(*) FROM seats WHERE id <> screen_id * 100 + (ASCII(row_label) - ASCII('A')) * 10 + seat_number), 0

  -- d) shows
  UNION ALL SELECT '30 show ids that break the convention (id DIV 1000 = movie id)', (SELECT COUNT(*) FROM shows WHERE id DIV 1000 <> movie_id), 0
  UNION ALL SELECT '31 movies that do not have exactly 30 shows',
         (SELECT COUNT(*) FROM (SELECT m.id FROM movies m LEFT JOIN shows s ON s.movie_id = m.id GROUP BY m.id HAVING COUNT(s.id) <> 30) x), 0
  UNION ALL SELECT '32 cinemas that do not have exactly 90 shows',
         (SELECT COUNT(*) FROM (SELECT c.id FROM cinemas c LEFT JOIN screens sc ON sc.cinema_id = c.id LEFT JOIN shows s ON s.screen_id = sc.id GROUP BY c.id HAVING COUNT(s.id) <> 90) x), 0
  UNION ALL SELECT '33 shows at a different cinema than the application schedules',
         (SELECT COUNT(*) FROM shows s JOIN screens sc ON sc.id = s.screen_id
          WHERE sc.cinema_id <> ((s.movie_id + ((s.id MOD 1000) DIV 100) + ((s.id MOD 100) DIV 10)) MOD 3) + 1), 0
  UNION ALL SELECT '34 distinct show dates (India time) = 5 days', (SELECT COUNT(DISTINCT DATE(start_time + INTERVAL 330 MINUTE)) FROM shows), 5
  UNION ALL SELECT '35 shows not at one of the 5 time slots (India time)',
         (SELECT COUNT(*) FROM shows WHERE TIME(start_time + INTERVAL 330 MINUTE) NOT IN ('10:30:00','13:45:00','17:00:00','20:15:00','22:45:00')), 0
  UNION ALL SELECT '36 shows whose status is not SCHEDULED or COMPLETED', (SELECT COUNT(*) FROM shows WHERE status NOT IN ('SCHEDULED','COMPLETED')), 0
  UNION ALL SELECT '37 overlapping shows on the same screen (movie length + 15 min cleaning)',
         (SELECT COUNT(*) FROM shows a
            JOIN shows b ON a.screen_id = b.screen_id AND a.id < b.id
            JOIN movies ma ON ma.id = a.movie_id JOIN movies mb ON mb.id = b.movie_id
          WHERE b.start_time < a.start_time + INTERVAL (ma.duration_min + 15) MINUTE
            AND a.start_time < b.start_time + INTERVAL (mb.duration_min + 15) MINUTE), 0

  -- e) prices
  UNION ALL SELECT '40 shows that do not have exactly 3 prices',
         (SELECT COUNT(*) FROM (SELECT s.id FROM shows s LEFT JOIN show_prices sp ON sp.show_id = s.id GROUP BY s.id HAVING COUNT(sp.show_id) <> 3) x), 0
  UNION ALL SELECT '41 prices that differ from the application (Aurora 220/320/520, Lotus 260/380/620, Starline 200/290/470)',
         (SELECT COUNT(*) FROM show_prices sp JOIN shows s ON s.id = sp.show_id JOIN screens sc ON sc.id = s.screen_id
          WHERE sp.price <> CASE sc.cinema_id
              WHEN 1 THEN CASE sp.category WHEN 'STANDARD' THEN 220 WHEN 'PREMIUM' THEN 320 ELSE 520 END
              WHEN 2 THEN CASE sp.category WHEN 'STANDARD' THEN 260 WHEN 'PREMIUM' THEN 380 ELSE 620 END
              WHEN 3 THEN CASE sp.category WHEN 'STANDARD' THEN 200 WHEN 'PREMIUM' THEN 290 ELSE 470 END
            END), 0

  -- f) no duplicates (the unique keys already prevent most of these; this proves it)
  UNION ALL SELECT '50 duplicate movie titles',  (SELECT COUNT(*) FROM (SELECT title FROM movies GROUP BY title HAVING COUNT(*) > 1) x), 0
  UNION ALL SELECT '51 duplicate genre names',   (SELECT COUNT(*) FROM (SELECT name FROM genres GROUP BY name HAVING COUNT(*) > 1) x), 0
  UNION ALL SELECT '52 duplicate seat positions',(SELECT COUNT(*) FROM (SELECT screen_id, row_label, seat_number FROM seats GROUP BY screen_id, row_label, seat_number HAVING COUNT(*) > 1) x), 0
  UNION ALL SELECT '53 duplicate shows (same screen and start time)', (SELECT COUNT(*) FROM (SELECT screen_id, start_time FROM shows GROUP BY screen_id, start_time HAVING COUNT(*) > 1) x), 0
  UNION ALL SELECT '54 movies without any genre', (SELECT COUNT(*) FROM movies m LEFT JOIN movie_genres mg ON mg.movie_id = m.id WHERE mg.movie_id IS NULL), 0
) AS checks
ORDER BY check_name;

-- ---------------------------------------------------------------------------------------------------
-- RESULT 2: shows by India date (information; the dates depend on the day you ran seed.sql)
-- Expected: 5 rows, 54 shows per day, dates = today and the next 4 days.
-- "already started" is only meaningful right after seeding (time keeps moving afterwards).
-- ---------------------------------------------------------------------------------------------------
SELECT DATE(start_time + INTERVAL 330 MINUTE) AS show_date_india,
       COUNT(*) AS shows,
       SUM(status = 'COMPLETED') AS marked_completed_at_seed_time,
       SUM(status = 'SCHEDULED') AS scheduled
FROM shows
GROUP BY DATE(start_time + INTERVAL 330 MINUTE)
ORDER BY show_date_india;

-- ---------------------------------------------------------------------------------------------------
-- RESULT 3: cinema prices actually stored (Standard / Premium / Recliner)
-- Expected: Aurora 220/320/520, Lotus 260/380/620, Starline 200/290/470, 90 shows each.
-- ---------------------------------------------------------------------------------------------------
SELECT c.name AS cinema,
       MIN(CASE WHEN sp.category = 'STANDARD' THEN sp.price END) AS standard,
       MIN(CASE WHEN sp.category = 'PREMIUM'  THEN sp.price END) AS premium,
       MIN(CASE WHEN sp.category = 'RECLINER' THEN sp.price END) AS recliner,
       COUNT(DISTINCT s.id) AS shows
FROM cinemas c
JOIN screens sc ON sc.cinema_id = c.id
JOIN shows s ON s.screen_id = sc.id
JOIN show_prices sp ON sp.show_id = s.id
GROUP BY c.id, c.name
ORDER BY c.id;

-- ---------------------------------------------------------------------------------------------------
-- RESULT 4: movies with their genres, and the number of shows
-- Expected: 9 rows, 30 shows each. (Genres are listed alphabetically; the sample data listed them in a
-- different order for movies 2, 5 and 9 because the schema has no "genre order" column.)
-- ---------------------------------------------------------------------------------------------------
SELECT m.id, m.title, m.language, m.duration_min, m.certificate,
       GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres,
       COUNT(DISTINCT s.id) AS shows
FROM movies m
JOIN movie_genres mg ON mg.movie_id = m.id
JOIN genres g ON g.id = mg.genre_id
LEFT JOIN shows s ON s.movie_id = m.id
GROUP BY m.id, m.title, m.language, m.duration_min, m.certificate
ORDER BY m.id;

-- ---------------------------------------------------------------------------------------------------
-- RESULT 5: screens, their cinema, seats and shows
-- Expected: 19 rows, 80 seats each. Show counts differ per screen (lower-numbered screens are used more).
-- ---------------------------------------------------------------------------------------------------
SELECT sc.id AS screen_id, c.name AS cinema, sc.name AS screen, COUNT(DISTINCT se.id) AS seats, COUNT(DISTINCT sh.id) AS shows
FROM screens sc
JOIN cinemas c ON c.id = sc.cinema_id
LEFT JOIN seats se ON se.screen_id = sc.id
LEFT JOIN shows sh ON sh.screen_id = sc.id
GROUP BY sc.id, c.name, sc.name
ORDER BY sc.id;
