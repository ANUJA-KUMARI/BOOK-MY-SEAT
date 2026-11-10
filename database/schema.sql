-- BOOK_MY_SEAT - Phase 4 database schema
-- Target: MySQL Server 8.0.44
-- Database: book_my_seat
-- This script creates the 11 tables approved in the Phase 1 design.
-- It does not drop the database or any existing tables.

CREATE DATABASE IF NOT EXISTS book_my_seat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE book_my_seat;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. MOVIES
CREATE TABLE IF NOT EXISTS movies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    language VARCHAR(80) NULL,
    duration_min SMALLINT UNSIGNED NOT NULL,
    certificate VARCHAR(20) NULL,
    release_date DATE NULL,
    poster_url VARCHAR(1000) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_movies_title (title),
    KEY idx_movies_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. GENRES
CREATE TABLE IF NOT EXISTS genres (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_genres_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. MOVIE_GENRES (many-to-many junction)
CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id BIGINT UNSIGNED NOT NULL,
    genre_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    CONSTRAINT fk_movie_genres_movie
        FOREIGN KEY (movie_id) REFERENCES movies (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_movie_genres_genre
        FOREIGN KEY (genre_id) REFERENCES genres (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CINEMAS
CREATE TABLE IF NOT EXISTS cinemas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address VARCHAR(500) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_cinemas_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. SCREENS
CREATE TABLE IF NOT EXISTS screens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cinema_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_screens_cinema_name (cinema_id, name),
    UNIQUE KEY uq_screens_id_cinema (id, cinema_id),
    CONSTRAINT fk_screens_cinema
        FOREIGN KEY (cinema_id) REFERENCES cinemas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SEATS
CREATE TABLE IF NOT EXISTS seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    screen_id BIGINT UNSIGNED NOT NULL,
    row_label VARCHAR(5) NOT NULL,
    seat_number SMALLINT UNSIGNED NOT NULL,
    category ENUM('STANDARD', 'PREMIUM', 'RECLINER') NOT NULL DEFAULT 'STANDARD',
    PRIMARY KEY (id),
    UNIQUE KEY uq_seats_screen_position (screen_id, row_label, seat_number),
    UNIQUE KEY uq_seats_id_screen (id, screen_id),
    CONSTRAINT fk_seats_screen
        FOREIGN KEY (screen_id) REFERENCES screens (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SHOWS
CREATE TABLE IF NOT EXISTS shows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    movie_id BIGINT UNSIGNED NOT NULL,
    screen_id BIGINT UNSIGNED NOT NULL,
    start_time DATETIME NOT NULL,
    status ENUM('SCHEDULED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'SCHEDULED',
    PRIMARY KEY (id),
    UNIQUE KEY uq_shows_screen_start (screen_id, start_time),
    UNIQUE KEY uq_shows_id_screen (id, screen_id),
    KEY idx_shows_movie_start (movie_id, start_time),
    CONSTRAINT fk_shows_movie
        FOREIGN KEY (movie_id) REFERENCES movies (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_shows_screen
        FOREIGN KEY (screen_id) REFERENCES screens (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. SHOW_PRICES (one price per seat category per show)
CREATE TABLE IF NOT EXISTS show_prices (
    show_id BIGINT UNSIGNED NOT NULL,
    category ENUM('STANDARD', 'PREMIUM', 'RECLINER') NOT NULL,
    price DECIMAL(8,2) NOT NULL,
    PRIMARY KEY (show_id, category),
    CONSTRAINT chk_show_prices_nonnegative CHECK (price >= 0),
    CONSTRAINT fk_show_prices_show
        FOREIGN KEY (show_id) REFERENCES shows (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_ref VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    show_id BIGINT UNSIGNED NOT NULL,
    status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bookings_ref (booking_ref),
    UNIQUE KEY uq_bookings_id_show (id, show_id),
    KEY idx_bookings_user_created (user_id, created_at),
    CONSTRAINT chk_bookings_total_nonnegative CHECK (total_amount >= 0),
    CONSTRAINT fk_bookings_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_show
        FOREIGN KEY (show_id) REFERENCES shows (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. BOOKING_SEATS
-- active = 1 means currently reserved; NULL means released after cancellation.
-- The unique key prevents two active reservations for one seat in one show.
-- screen_id plus composite foreign keys ensure the seat belongs to the show's screen.
CREATE TABLE IF NOT EXISTS booking_seats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    show_id BIGINT UNSIGNED NOT NULL,
    screen_id BIGINT UNSIGNED NOT NULL,
    seat_id BIGINT UNSIGNED NOT NULL,
    price_snapshot DECIMAL(8,2) NOT NULL,
    active TINYINT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_seats_show_seat_active (show_id, seat_id, active),
    KEY idx_booking_seats_booking_show (booking_id, show_id),
    CONSTRAINT chk_booking_seats_active CHECK (active = 1 OR active IS NULL),
    CONSTRAINT chk_booking_seats_price CHECK (price_snapshot >= 0),
    CONSTRAINT fk_booking_seats_booking_show
        FOREIGN KEY (booking_id, show_id)
        REFERENCES bookings (id, show_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_booking_seats_show_screen
        FOREIGN KEY (show_id, screen_id)
        REFERENCES shows (id, screen_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_booking_seats_seat_screen
        FOREIGN KEY (seat_id, screen_id)
        REFERENCES seats (id, screen_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify the resulting schema:
SHOW TABLES;
