-- BOOK_MY_SEAT Stage 2: forward-only booking lifecycle migration.
-- Target: MySQL 8.0.44. Take and verify a backup before running this file.
-- Run exactly once against the existing book_my_seat database. This does not delete,
-- rewrite, expire, or reclassify any existing CONFIRMED/CANCELLED booking or seat row.
USE book_my_seat;

ALTER TABLE bookings
  MODIFY COLUMN status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')
    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN expires_at DATETIME NULL AFTER cancelled_at,
  ADD COLUMN confirmed_at DATETIME NULL AFTER expires_at,
  ADD KEY idx_bookings_expiry (status, expires_at, id);

-- Existing rows deliberately retain their original status and receive NULL lifecycle
-- timestamps. Only bookings created after this migration can become PENDING.
