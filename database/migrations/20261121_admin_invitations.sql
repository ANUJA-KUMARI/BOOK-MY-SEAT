-- Admin invitations and approval workflow. Forward-only; preserves existing users and roles.
USE book_my_seat;

CREATE TABLE admin_invitations (
  admin_id VARCHAR(20) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_invitation_token_hash (token_hash),
  KEY idx_admin_invitation_expiry (expires_at),
  CONSTRAINT fk_admin_invitation_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_accounts (
  user_id BIGINT UNSIGNED NOT NULL,
  admin_id VARCHAR(20) NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  is_first_admin BOOLEAN NOT NULL DEFAULT FALSE,
  invited_by BIGINT UNSIGNED NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_admin_accounts_admin_id (admin_id),
  KEY idx_admin_accounts_status_created (status, created_at),
  CONSTRAINT fk_admin_account_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_admin_account_inviter FOREIGN KEY (invited_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_admin_account_approver FOREIGN KEY (approved_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
