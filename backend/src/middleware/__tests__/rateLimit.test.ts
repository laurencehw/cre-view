import express from 'express';
import request from 'supertest';
import { rateLimit } from '../rateLimit';

function createApp(max: number, windowMs = 60_000) {
  const app = express();
  app.use(rateLimit({ max, windowMs }));
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimit', () => {
  it('allows requests within the limit', async () => {
    const app = createApp(5);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBe('4');
  });

  it('blocks requests exceeding the limit with 429', async () => {
    const app = createApp(3);
    // Use up the limit
    await request(app).get('/test');
    await request(app).get('/test');
    await request(app).get('/test');

    // Fourth request should be blocked
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(typeof res.body.retryAfter).toBe('number');
  });

  it('sets remaining header correctly as requests are made', async () => {
    const app = createApp(3);
    const res1 = await request(app).get('/test');
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    const res2 = await request(app).get('/test');
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');

    const res3 = await request(app).get('/test');
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');
  });
});
