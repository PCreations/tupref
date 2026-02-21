import 'dotenv/config';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { questions } from './src/db/schema.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = fastify({ logger: true });

// Serve static files
server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
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

  // Return updated counts
  const [row] = await db
    .select({
      countA: questions.countA,
      countB: questions.countB,
    })
    .from(questions)
    .where(eq(questions.id, questionId));

  if (!row) {
    return reply.status(404).send({ error: 'Question not found' });
  }

  const total = row.countA + row.countB;
  return {
    countA: row.countA,
    countB: row.countB,
    percentA: total > 0 ? Math.round((row.countA / total) * 100) : 50,
    percentB: total > 0 ? Math.round((row.countB / total) * 100) : 50,
    total,
  };
});

const port = parseInt(process.env.PORT ?? '8080', 10);
server.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
