-- Runs once, on a fresh volume. Integration tests truncate tables, so they get
-- their own database instead of wiping the dev one under a running sync loop.
CREATE DATABASE kitchen_sync_test;
