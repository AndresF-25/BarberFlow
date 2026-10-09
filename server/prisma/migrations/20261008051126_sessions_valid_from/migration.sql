-- Renombra la columna conservando los datos (Prisma generaba DROP + ADD).
ALTER TABLE "users" RENAME COLUMN "password_changed_at" TO "sessions_valid_from";
