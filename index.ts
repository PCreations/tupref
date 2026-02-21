import 'dotenv/config';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { questions } from './src/db/schema.js';
import questionsData from './src/questions.json' with { type: 'json' };
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = fastify({ logger: true });

// Serve static files
// In dev: __dirname = project root, in prod (built): __dirname = dist/
import { existsSync } from 'fs';
const publicDir = existsSync(join(__dirname, 'public'))
  ? join(__dirname, 'public')
  : join(__dirname, '..', 'public');

server.register(fastifyStatic, {
  root: publicDir,
  prefix: '/',
});

// GET /api/questions — return all question IDs + text (no counts)
server.get('/api/questions', async () => {
  const rows = await db
    .select({
      id: questions.id,
      optionA: questions.optionA,
      optionB: questions.optionB,
    })
    .from(questions);
  return rows;
});

// POST /api/answer — record a vote, return percentages
server.post<{
  Body: { questionId: string; choice: 'A' | 'B' };
}>('/api/answer', async (request, reply) => {
  const { questionId, choice } = request.body;

  if (!questionId || (choice !== 'A' && choice !== 'B')) {
    return reply.status(400).send({ error: 'Invalid request' });
  }

  const column = choice === 'A' ? questions.countA : questions.countB;

  // Atomic increment
  await db
    .update(questions)
    .set({ [choice === 'A' ? 'countA' : 'countB']: sql`${column} + 1` })
    .where(eq(questions.id, questionId));

  // Return updated counts + character info based on choice
  const [row] = await db
    .select({
      countA: questions.countA,
      countB: questions.countB,
      characterNameA: questions.characterNameA,
      characterPlayA: questions.characterPlayA,
      characterQuoteA: questions.characterQuoteA,
      characterNameB: questions.characterNameB,
      characterPlayB: questions.characterPlayB,
      characterQuoteB: questions.characterQuoteB,
    })
    .from(questions)
    .where(eq(questions.id, questionId));

  if (!row) {
    return reply.status(404).send({ error: 'Question not found' });
  }

  const charName = choice === 'A' ? row.characterNameA : row.characterNameB;
  const charPlay = choice === 'A' ? row.characterPlayA : row.characterPlayB;
  const charQuote = choice === 'A' ? row.characterQuoteA : row.characterQuoteB;

  const total = row.countA + row.countB;
  return {
    countA: row.countA,
    countB: row.countB,
    percentA: total > 0 ? Math.round((row.countA / total) * 100) : 50,
    percentB: total > 0 ? Math.round((row.countB / total) * 100) : 50,
    total,
    character: charName ? {
      name: charName,
      play: charPlay,
      quote: charQuote,
    } : null,
  };
});

// Seed questions on startup (idempotent upsert)
async function seedQuestions() {
  try {
    for (const q of questionsData) {
      await db
        .insert(questions)
        .values({
          id: q.id,
          optionA: q.optionA,
          optionB: q.optionB,
          countA: 0,
          countB: 0,
          characterNameA: q.characterNameA ?? null,
          characterPlayA: q.characterPlayA ?? null,
          characterQuoteA: q.characterQuoteA ?? null,
          characterNameB: q.characterNameB ?? null,
          characterPlayB: q.characterPlayB ?? null,
          characterQuoteB: q.characterQuoteB ?? null,
        })
        .onConflictDoUpdate({
          target: questions.id,
          set: {
            optionA: sql`excluded.option_a`,
            optionB: sql`excluded.option_b`,
            characterNameA: sql`excluded.character_name_a`,
            characterPlayA: sql`excluded.character_play_a`,
            characterQuoteA: sql`excluded.character_quote_a`,
            characterNameB: sql`excluded.character_name_b`,
            characterPlayB: sql`excluded.character_play_b`,
            characterQuoteB: sql`excluded.character_quote_b`,
          },
        });
    }
    console.log(`Seeded ${questionsData.length} questions`);
  } catch (e) {
    console.error('Seed failed:', e);
  }
}

const port = parseInt(process.env.PORT ?? '8080', 10);
seedQuestions().then(() => {
  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
});
