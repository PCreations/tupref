import 'dotenv/config';
import { db } from './db/index.js';
import { questions as questionsTable } from './db/schema.js';
import questionsData from './questions.json' with { type: 'json' };
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('Seeding questions...');

  for (const q of questionsData) {
    await db
      .insert(questionsTable)
      .values({
        id: q.id,
        optionA: q.optionA,
        optionB: q.optionB,
        countA: 0,
        countB: 0,
      })
      .onConflictDoUpdate({
        target: questionsTable.id,
        set: {
          optionA: sql`excluded.option_a`,
          optionB: sql`excluded.option_b`,
        },
      });
  }

  console.log(`Seeded ${questionsData.length} questions.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
