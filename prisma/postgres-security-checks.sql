-- PostgreSQL security and configuration checks for Suaka Cuanku
-- Run with:
-- psql "$DATABASE_URL" -f prisma/postgres-security-checks.sql

\echo ''
\echo '1. CHECK ANONYMOUS ROLE'
SELECT rolname
FROM pg_roles
WHERE rolname = '' OR lower(rolname) = 'anonymous';

\echo ''
\echo '2. CHECK SUPERUSER / ALL PRIVILEGES'
SELECT usename, usesuper
FROM pg_user
WHERE usename IN ('postgres', 'app_user');

\echo ''
\echo '3. CHECK PASSWORD HASH FORMAT IN "User" TABLE'
SELECT id, email, password
FROM "User"
WHERE password !~ '^\$2[aby]\$[0-9]{2}\$';

\echo ''
\echo '4. CHECK FOREIGN KEY ON Loan TABLE (ADAPTATION OF pinjaman)'
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'Loan';

\echo ''
\echo '5. CHECK UNIQUE CONSTRAINT ON User.email'
SELECT constraint_name
FROM information_schema.constraint_column_usage
WHERE table_name = 'User' AND column_name = 'email'
INTERSECT
SELECT constraint_name
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE';

\echo ''
\echo '6. CHECK BACKUP/RESTORE RELATED TABLE'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'admin_backup_settings';

\echo ''
\echo '7. CHECK PORT / LISTEN / SSL / LOGGING / ARCHIVE CONFIG'
SHOW port;
SHOW listen_addresses;
SHOW ssl;
SHOW archive_mode;
SHOW archive_command;
SHOW logging_collector;
SHOW log_statement;
SHOW log_min_duration_statement;

\echo ''
\echo '8. CHECK PASSWORD / SENSITIVE HASHED DATA'
SELECT 'User.password' AS column_name, COUNT(*) AS invalid_rows
FROM "User"
WHERE password !~ '^\$2[aby]\$[0-9]{2}\$'
UNION ALL
SELECT 'security_questions.answer' AS column_name, COUNT(*) AS invalid_rows
FROM security_questions
WHERE answer !~ '^\$2[aby]\$[0-9]{2}\$';

\echo ''
\echo '9. CHECK FK / INDEX / CONSTRAINT SUMMARY'
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Loan', 'Payment', 'AuditLog', 'security_questions', 'admin_backup_settings')
ORDER BY tablename, indexname;
