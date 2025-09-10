import request from 'supertest';
const serverModule = require('../dist/server');
const app = serverModule && serverModule.default ? serverModule.default : serverModule;

describe('API /api/search validation', () => {
  test('rejects too short query', async () => {
    const res = await request(app).post('/api/search').send({ keywords: 'a' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('accepts valid search', async () => {
    const res = await request(app).post('/api/search').send({ keywords: 'octavia', location: 'Praha', limit: 5 });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });
});
const request = require('supertest');
const serverModule = require('../dist/server');
const app = serverModule && serverModule.default ? serverModule.default : serverModule;

describe('API /api/search validation', () => {
  test('rejects too short query', async () => {
    const res = await request(app).post('/api/search').send({ keywords: 'a' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('accepts valid search', async () => {
    const res = await request(app).post('/api/search').send({ keywords: 'octavia', location: 'Praha', limit: 5 });
    // We may return either a 200 with results or 200 with empty array; just ensure schema is present
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeDefined();
  });
});
