ALTER TABLE "auth_challenges"
  DROP COLUMN IF EXISTS "email_code_hash",
  DROP COLUMN IF EXISTS "email_code_expires_at",
  DROP COLUMN IF EXISTS "email_verified_at",
  DROP COLUMN IF EXISTS "email_attempt_count";

ALTER TABLE "password_reset_challenges"
  DROP COLUMN IF EXISTS "email_code_hash",
  DROP COLUMN IF EXISTS "email_code_expires_at";

ALTER TABLE "sensitive_action_challenges"
  DROP COLUMN IF EXISTS "email_code_hash",
  DROP COLUMN IF EXISTS "email_code_expires_at";
