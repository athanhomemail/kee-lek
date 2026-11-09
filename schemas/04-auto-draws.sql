-- Additive and repeatable: existing draws, bills, results and users are untouched.
CREATE TABLE IF NOT EXISTS lottery_draw_schedules (
  lottery_id BIGINT PRIMARY KEY,
  config JSON NOT NULL,
  last_checked_at DATETIME NULL,
  last_status VARCHAR(255) NULL,
  last_created_draw_id BIGINT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lottery_id) REFERENCES lotteries(id) ON DELETE CASCADE,
  FOREIGN KEY (last_created_draw_id) REFERENCES draws(id) ON DELETE SET NULL
);
