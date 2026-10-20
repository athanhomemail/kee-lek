-- Additive, repeatable migration. No bill, draw, or user data is deleted.
SET @catalog_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='lotteries' AND COLUMN_NAME='deleted_at');
SET @catalog_sql = IF(@catalog_column_exists=0, 'ALTER TABLE lotteries ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL', 'SELECT 1');
PREPARE catalog_migration FROM @catalog_sql;
EXECUTE catalog_migration;
DEALLOCATE PREPARE catalog_migration;
