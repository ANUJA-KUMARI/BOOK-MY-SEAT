-- =====================================================================================================
-- BOOK_MY_SEAT - Phase 4: create the dedicated, least-privilege MySQL user used by the backend
-- Run this ONCE in MySQL Workbench as an administrator (for example root). It does not touch any table or data.
--
-- THE BACKEND NEVER USES root. This user may only READ the book_my_seat database (SELECT), which is all Phase 4 needs.
-- Later phases will add INSERT / UPDATE / DELETE on specific tables when bookings and accounts are implemented.
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

-- Check the result. Expected: one row per account, each showing only "GRANT SELECT ON `book_my_seat`.* ..." (plus USAGE).
SHOW GRANTS FOR 'bms_app'@'127.0.0.1';
SHOW GRANTS FOR 'bms_app'@'localhost';
