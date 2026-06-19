const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1413@localhost:5432/sigha';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE "disciplinas"
      ADD COLUMN IF NOT EXISTS "blocosSemanais" INTEGER;
    `);

    await client.query(`
      UPDATE "disciplinas"
      SET "blocosSemanais" = GREATEST(1, CEIL("cargaHoraria"::numeric / 20))
      WHERE "blocosSemanais" IS NULL;
    `);

    await client.query(`
      ALTER TABLE "disciplinas"
      ALTER COLUMN "blocosSemanais" SET NOT NULL;
    `);

    console.log('SQL executed successfully');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
