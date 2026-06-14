-- Migration Sprint 3 — SIGHA
-- Adiciona PeriodoLetivo e atualiza Turma
-- Execute: npx prisma migrate dev --name sprint3_turmas_periodo_letivo

-- 1. Enum novo
CREATE TYPE "StatusPeriodoLetivo" AS ENUM ('PLANEJAMENTO', 'ATIVO', 'FINALIZADO');

-- 2. Tabela periodos_letivos
CREATE TABLE "periodos_letivos" (
    "id"         TEXT NOT NULL,
    "ano"        INTEGER NOT NULL,
    "semestre"   INTEGER NOT NULL,
    "descricao"  TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim"    TIMESTAMP(3) NOT NULL,
    "status"     "StatusPeriodoLetivo" NOT NULL DEFAULT 'PLANEJAMENTO',
    "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "periodos_letivos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "periodos_letivos_ano_semestre_key" ON "periodos_letivos"("ano", "semestre");

-- 3. Adiciona coluna periodoLetivoId na tabela turmas
--    (nullable primeiro para não quebrar dados existentes)
ALTER TABLE "turmas" ADD COLUMN "periodoLetivoId" TEXT;

-- 4. Remove coluna semestre antiga (depois de migrar os dados — ver seed patch abaixo)
--    Só execute esta linha APÓS rodar o seed patch que preenche periodoLetivoId
-- ALTER TABLE "turmas" DROP COLUMN "semestre";

-- 5. Remove constraint de unicidade antiga (codigo único global)
ALTER TABLE "turmas" DROP CONSTRAINT IF EXISTS "turmas_codigo_key";

-- 6. Cria nova constraint: código único por período letivo
CREATE UNIQUE INDEX "turmas_codigo_periodoLetivoId_key" ON "turmas"("codigo", "periodoLetivoId");

-- 7. FK
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_periodoLetivoId_fkey"
    FOREIGN KEY ("periodoLetivoId") REFERENCES "periodos_letivos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
