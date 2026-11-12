-- =====================================================================================================
-- BOOK_MY_SEAT - Dedicated, least-privilege MySQL user used by the backend
-- Run this ONCE in MySQL Workbench as an administrator (for example root).
-- It does not touch any table or data.
--
-- The backend never uses root. SELECT is available throughout the app database.
-- Write permissions are limited to the specific tables and operations needed by implemented features.
--
-- SECURITY: replace CHANGE_ME_TO_A_STRONG_PASSWORD below in the Workbench editor, run the script, and then
-- DO NOT SAVE the file with the real password in it. Put the same password in backend/.env (DB_PASSWORD) only.
--
-- Two accounts are created because MySQL sometimes treats a connection to 127.0.0.1 as coming from "localhost".
-- =====================================================================================================

CREATE USER IF NOT EXISTS 'bms_app'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME_TO_A_STRONG_PASSWORD';
CREATE USER IF NOT EXISTS 'bms_app'@'localhost'  IDENTIFIED BY 'CHANGE_ME_TO_A_STRONG_PASSWORD';

GRANT SELECT ON book_my_seat.* TO 'bms_app'@'127.0.0.1';
GRANT SELECT ON book_my_seat.* TO 'bms_app'@'localhost';

-- Phase 5: registration may create rows in users, but cannot modify or delete them.
GRANT INSERT ON book_my_seat.users TO 'bms_app'@'127.0.0.1';
GRANT INSERT ON book_my_seat.users TO 'bms_app'@'localhost';

-- Phase 8 Stage 4: cinema, screen and seat-layout administration.
GRANT INSERT, UPDATE ON book_my_seat.cinemas TO 'bms_app'@'127.0.0.1';
GRANT INSERT, UPDATE ON book_my_seat.cinemas TO 'bms_app'@'localhost';
GRANT INSERT, UPDATE ON book_my_seat.screens TO 'bms_app'@'127.0.0.1';
GRANT INSERT, UPDATE ON book_my_seat.screens TO 'bms_app'@'localhost';
GRANT INSERT, DELETE ON book_my_seat.seats TO 'bms_app'@'127.0.0.1';
GRANT INSERT, DELETE ON book_my_seat.seats TO 'bms_app'@'localhost';

-- Phase 8 Stage 5: show scheduling, status changes and category-wise pricing.
GRANT INSERT, UPDATE ON book_my_seat.shows TO 'bms_app'@'127.0.0.1';
GRANT INSERT, UPDATE ON book_my_seat.shows TO 'bms_app'@'localhost';
GRANT INSERT, UPDATE ON book_my_seat.show_prices TO 'bms_app'@'127.0.0.1';
GRANT INSERT, UPDATE ON book_my_seat.show_prices TO 'bms_app'@'localhost';

-- Verify the result. Both accounts should have only the table-level write permissions listed above.
SHOW GRANTS FOR 'bms_app'@'127.0.0.1';
SHOW GRANTS FOR 'bms_app'@'localhost';
