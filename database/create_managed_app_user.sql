-- BOOK_MY_SEAT — dedicated application account for a managed/cloud MySQL deployment
-- Run using the managed database administrator account, after creating database book_my_seat
-- and applying database/schema.sql.
--
-- IMPORTANT:
-- 1. Replace CHANGE_ME with a unique strong password before running.
-- 2. Host '%' is needed by many managed MySQL services because app egress IPs may change.
--    Restrict inbound database access with the provider firewall/network policy wherever possible.
-- 3. Do not commit this file after inserting a real password.
-- 4. This account is not an administrator and cannot create/drop databases or users.

CREATE USER IF NOT EXISTS 'bms_app'@'%' IDENTIFIED BY 'CHANGE_ME_TO_A_UNIQUE_STRONG_PASSWORD';

GRANT SELECT ON book_my_seat.* TO 'bms_app'@'%';

-- Customer registration
GRANT INSERT ON book_my_seat.users TO 'bms_app'@'%';

-- Movie and genre catalogue management
GRANT INSERT, UPDATE ON book_my_seat.movies TO 'bms_app'@'%';
GRANT INSERT, UPDATE, DELETE ON book_my_seat.genres TO 'bms_app'@'%';
GRANT INSERT, DELETE ON book_my_seat.movie_genres TO 'bms_app'@'%';

-- Cinema, screen and seat-layout management
GRANT INSERT, UPDATE ON book_my_seat.cinemas TO 'bms_app'@'%';
GRANT INSERT, UPDATE ON book_my_seat.screens TO 'bms_app'@'%';
GRANT INSERT, DELETE ON book_my_seat.seats TO 'bms_app'@'%';

-- Show scheduling, status and pricing
GRANT INSERT, UPDATE ON book_my_seat.shows TO 'bms_app'@'%';
GRANT INSERT, UPDATE ON book_my_seat.show_prices TO 'bms_app'@'%';

-- Booking creation and cancellation
GRANT INSERT, UPDATE ON book_my_seat.bookings TO 'bms_app'@'%';
GRANT INSERT, UPDATE ON book_my_seat.booking_seats TO 'bms_app'@'%';

SHOW GRANTS FOR 'bms_app'@'%';
