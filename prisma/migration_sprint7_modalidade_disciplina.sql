-- Migration Sprint 7 — SIGHA
-- Adiciona enum ModalidadeDisciplina e coluna modalidade em disciplinas
-- Execute: npx prisma migrate dev --name sprint7_modalidade_disciplina

CREATE TYPE "ModalidadeDisciplina" AS ENUM ('PRESENCIAL', 'ONLINE');

ALTER TABLE "disciplinas"
  ADD COLUMN "modalidade" "ModalidadeDisciplina" NOT NULL DEFAULT 'PRESENCIAL';
