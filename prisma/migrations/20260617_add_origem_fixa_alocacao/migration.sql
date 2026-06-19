-- Add origem and fixa to alocacoes
CREATE TYPE "OrigemAlocacao" AS ENUM ('AUTOMATICA', 'MANUAL');

ALTER TABLE "alocacoes"
ADD COLUMN "origem" "OrigemAlocacao" NOT NULL DEFAULT 'AUTOMATICA';

ALTER TABLE "alocacoes"
ADD COLUMN "fixa" BOOLEAN NOT NULL DEFAULT false;
