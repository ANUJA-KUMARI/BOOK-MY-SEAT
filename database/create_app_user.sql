-- =====================================================================================================
-- BOOK_MY_SEAT - Dedicated, least-privilege MySQL user used by the backend
-- Run this ONCE in MySQL Workbench as an administrator (for example root).
-- It does not touch any table or data.
--
-- The backend never uses root. Phase 4 requires SELECT on the database.
-- Phase 5 registration additionally requires INSERT on users only.
-- No UPDATE or DELETE permission is granted by this script.
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

-- Verify the result. Both accounts should show SELECT on book_my_seat.* and INSERT on book_my_seat.users.
SHOW GRANTS FOR 'bms_app'@'127.0.0.1';
SHOW GRANTS FOR 'bms_app'@'localhost';
