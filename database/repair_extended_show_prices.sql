-- BOOK_MY_SEAT: repair ticket prices for the 810 shows inserted by the
-- schedule-extension script before its original price INSERT failed.
-- Safe to rerun: inserts only missing category rows; does not alter shows/bookings.

USE book_my_seat;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Every extension show repeats a source timetable show exactly 5, 10, or
-- 15 days earlier, at the same UTC start time, screen and movie.
-- Prefer the closest earlier source show that already has its category price.
INSERT INTO show_prices (show_id, category, price)
SELECT ranked.added_show_id, ranked.category, ranked.price
FROM (
  SELECT added.id AS added_show_id,
         source_price.category,
         source_price.price,
         ROW_NUMBER() OVER (
           PARTITION BY added.id, source_price.category
           ORDER BY source_show.start_time DESC
         ) AS source_rank
  FROM shows AS added
  JOIN shows AS source_show
    ON source_show.movie_id = added.movie_id
   AND source_show.screen_id = added.screen_id
   AND source_show.start_time IN (
     DATE_SUB(added.start_time, INTERVAL 5 DAY),
     DATE_SUB(added.start_time, INTERVAL 10 DAY),
     DATE_SUB(added.start_time, INTERVAL 15 DAY)
   )
  JOIN show_prices AS source_price
    ON source_price.show_id = source_show.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM show_prices already_there
    WHERE already_there.show_id = added.id
      AND already_there.category = source_price.category
  )
) AS ranked
WHERE ranked.source_rank = 1;

-- Verification includes shows with ZERO prices (LEFT JOIN is intentional).
SELECT DATE(s.start_time + INTERVAL 330 MINUTE) AS show_date_india,
       COUNT(DISTINCT s.id) AS show_count,
       SUM(CASE WHEN COALESCE(pc.price_count, 0) = 3 THEN 1 ELSE 0 END) AS shows_with_all_3_prices,
       SUM(CASE WHEN COALESCE(pc.price_count, 0) <> 3 THEN 1 ELSE 0 END) AS shows_missing_prices
FROM shows AS s
LEFT JOIN (
  SELECT show_id, COUNT(DISTINCT category) AS price_count
  FROM show_prices
  GROUP BY show_id
) AS pc ON pc.show_id = s.id
WHERE s.start_time >= (
  SELECT MIN(start_time) FROM shows
  WHERE id NOT IN (SELECT show_id FROM show_prices)
)
GROUP BY DATE(s.start_time + INTERVAL 330 MINUTE)
ORDER BY show_date_india;

-- Overall price coverage for every scheduled show in the database.
SELECT
  COUNT(*) AS scheduled_shows,
  SUM(CASE WHEN COALESCE(pc.price_count, 0) = 3 THEN 1 ELSE 0 END) AS fully_priced_shows,
  SUM(CASE WHEN COALESCE(pc.price_count, 0) <> 3 THEN 1 ELSE 0 END) AS shows_missing_prices
FROM shows AS s
LEFT JOIN (
  SELECT show_id, COUNT(DISTINCT category) AS price_count
  FROM show_prices
  GROUP BY show_id
) AS pc ON pc.show_id = s.id
WHERE s.status = 'SCHEDULED';
