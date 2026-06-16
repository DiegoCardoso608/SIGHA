-- Migration Sprint 3 — Período Letivo e Turmas
-- CreateEnum
CREATE TYPE "StatusPeriodoLetivo" AS ENUM ('PLANEJAMENTO', 'ATIVO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "periodos_letivos" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "status" "StatusPeriodoLetivo" NOT NULL DEFAULT 'PLANEJAMENTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_letivos_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "turmas" DROP CONSTRAINT IF EXISTS "turmas_codigo_key";
ALTER TABLE "turmas" ADD COLUMN "periodoLetivoId" TEXT;
ALTER TABLE "turmas" DROP COLUMN "semestre";

-- CreateIndex
CREATE UNIQUE INDEX "periodos_letivos_ano_semestre_key" ON "periodos_letivos"("ano", "semestre");
CREATE UNIQUE INDEX "turmas_codigo_periodoLetivoId_key" ON "turmas"("codigo", "periodoLetivoId");

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_periodoLetivoId_fkey" FOREIGN KEY ("periodoLetivoId") REFERENCES "periodos_letivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
