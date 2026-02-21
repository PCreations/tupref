import { integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const questions = pgTable('questions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  countA: integer('count_a').notNull().default(0),
  countB: integer('count_b').notNull().default(0),
  characterName: text('character_name'),
  characterPlay: text('character_play'),
  characterQuote: text('character_quote'),
});
