import { initDb } from '../src/lib/db';

const db = initDb();

const count = (db.prepare('SELECT COUNT(*) as count FROM endpoints').get() as any).count;

if (count === 0) {
  const insert = db.prepare('INSERT INTO endpoints (name, url) VALUES (?, ?)');
  insert.run('Paul Winkler AI', 'http://165.227.185.182/api/v1/health');
  insert.run('GrantCraft AI', 'https://147.182.217.191');
  insert.run('Zerona Content Engine', 'https://159.89.91.177/health');
  insert.run('CommandPost', 'http://localhost:3004');
  console.log('Seeded 4 endpoints.');
} else {
  console.log(`Endpoints table already has ${count} rows. Skipping seed.`);
}

db.close();
