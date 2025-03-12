-- lib/db/migrations/0003_add_medical_history.sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "medicalHistory" text;