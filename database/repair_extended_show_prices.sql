-- Repair category prices for the 810 shows already inserted by the first
-- schedule-extension run, which stopped with MySQL ERROR 1137.
-- Run this once in MySQL Workbench using the book_my_seat database.
-- It adds only missing show_prices rows; it does not change shows or bookings.

USE book_my_seat;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @extension_last_date = (
  SELECT MAX(DATE(start_time + INTERVAL 330 MINUTE)) FROM shows
);
SET @extension_first_date = DATE_SUB(@extension_last_date, INTERVAL 14 DAY);

-- The original 15-day extension repeats the original five-day timetable three times.
-- For each added date, find its matching source show 5, 10, or 15 days earlier.
INSERT INTO show_prices (show_id, category, price)
SELECT added.id, source_price.category, source_price.price
FROM shows AS added
JOIN movies AS added_movie ON added_movie.id = added.movie_id
JOIN shows AS source_show
  ON source_show.movie_id = added.movie_id
 AND source_show.screen_id = added.screen_id
 AND source_show.start_time = DATE_SUB(
       added.start_time,
       INTERVAL (
         5 + 5 * FLOOR(
           (DATEDIFF(DATE(added.start_time + INTERVAL 330 MINUTE), @extension_first_date)) / 5
         )
       ) DAY
     )
JOIN show_prices AS source_price ON source_price.show_id = source_show.id
WHERE DATE(added.start_time + INTERVAL 330 MINUTE)
      BETWEEN @extension_first_date AND @extension_last_date
  AND DATE(added.start_time + INTERVAL 330 MINUTE) > DATE_SUB(@extension_first_date, INTERVAL 1 DAY)
  AND NOT EXISTS (
    SELECT 1
    FROM show_prices existing_price
    WHERE existing_price.show_id = added.id
      AND existing_price.category = source_price.category
  );

-- Verification: all shows in the 15-day extension window should have 3 price rows.
SELECT DATE(s.start_time + INTERVAL 330 MINUTE) AS show_date_india,
       COUNT(*) AS show_count,
       SUM(price_counts.price_count = 3) AS shows_with_all_3_prices,
       SUM(price_counts.price_count <> 3) AS shows_missing_prices
FROM shows s
JOIN (
  SELECT show_id, COUNT(*) AS price_count
  FROM show_prices
  GROUP BY show_id
) price_counts ON price_counts.show_id = s.id
WHERE DATE(s.start_time + INTERVAL 330 MINUTE)
      BETWEEN @extension_first_date AND @extension_last_date
GROUP BY DATE(s.start_time + INTERVAL 330 MINUTE)
ORDER BY show_date_india;

SELECT m.id, m.title, COUNT(s.id) AS future_shows
FROM movies m
LEFT JOIN shows s ON s.movie_id = m.id
  AND s.status = 'SCHEDULED'
  AND s.start_time > UTC_TIMESTAMP()
GROUP BY m.id, m.title
ORDER BY m.id;
