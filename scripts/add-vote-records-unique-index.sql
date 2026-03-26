-- Add unique constraint at DB level to prevent duplicate voting per user per poll.
-- Safe to run multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_records_vote_user
ON vote_records(vote_id, user_id);
