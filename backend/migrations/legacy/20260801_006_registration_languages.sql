-- Adds registration-time language preferences for providers.
-- Enables persisting selected languages before provider profile creation.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS registration_languages JSON NULL AFTER skills;
