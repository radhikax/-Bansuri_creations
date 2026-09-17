import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/db';

describe('database connection', () => {
  it('connects and can query an empty categories table', async () => {
    const categories = await prisma.category.findMany();
    expect(categories).toEqual([]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
