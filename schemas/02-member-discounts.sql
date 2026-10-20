-- Additive migration: no existing bill or user data is changed. Safe to run again.
CREATE TABLE IF NOT EXISTS member_discounts (
  leader_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  lottery_id BIGINT NOT NULL,
  rates JSON NOT NULL,
  PRIMARY KEY (member_id, lottery_id),
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lottery_id) REFERENCES lotteries(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS bill_discount_snapshots (
  bill_id BIGINT PRIMARY KEY,
  rates JSON NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);
