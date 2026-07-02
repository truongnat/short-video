import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:25432/videotool?schema=public';
  console.log('Connecting to:', connectionString);
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const settings = await prisma.systemSetting.findMany();
    console.log('--- SYSTEM SETTINGS IN DB ---');
    console.log(JSON.stringify(settings, null, 2));

    const ideas = await prisma.idea.findMany();
    console.log('--- IDEAS IN DB ---');
    console.log(JSON.stringify(ideas, null, 2));

    const jobs = await prisma.generationJob.findMany();
    console.log('--- JOBS IN DB ---');
    console.log(JSON.stringify(jobs, null, 2));
  } catch (e) {
    console.error('Error querying DB:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
