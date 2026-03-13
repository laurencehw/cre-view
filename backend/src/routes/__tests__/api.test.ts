import request from 'supertest';
import app from '../../index';
import { signToken } from '../../middleware/auth';

let authToken: string;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-api-tests';
  authToken = signToken({ sub: 'test-user', email: 'test@example.com', role: 'admin' });
});

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('GET /api/buildings', () => {
  it('returns paginated list of buildings with totalPages', async () => {
    const res = await request(app).get('/api/buildings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    expect(res.body.totalPages).toBe(Math.ceil(res.body.total / res.body.limit));
  });

  it('respects custom page and limit params', async () => {
    const res = await request(app).get('/api/buildings?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it('filters by search query', async () => {
    const res = await request(app).get('/api/buildings?search=Empire');
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toContain('Empire');
  });
});

describe('GET /api/buildings/:id', () => {
  it('returns a building by id', async () => {
    const res = await request(app).get('/api/buildings/bld_001');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('bld_001');
    expect(res.body.name).toBe('Empire State Building');
  });

  it('returns 404 for unknown building', async () => {
    const res = await request(app).get('/api/buildings/bld_unknown');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/buildings/:id/financials', () => {
  it('returns financial data for a building with auth', async () => {
    const res = await request(app)
      .get('/api/buildings/bld_001/financials')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.buildingId).toBe('bld_001');
    expect(res.body.valuation).toBeDefined();
    expect(res.body.debt).toBeDefined();
    expect(res.body.equity).toBeDefined();
    expect(Array.isArray(res.body.equity.capTable)).toBe(true);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/buildings/bld_001/financials');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 for unknown building financials', async () => {
    const res = await request(app)
      .get('/api/buildings/bld_unknown/financials')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/buildings/:id/financials/export', () => {
  it('returns CSV with correct headers and content', async () => {
    const res = await request(app)
      .get('/api/buildings/bld_001/financials/export')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
    // Verify header row
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('"Section","Field","Value"');
    // Verify building data is present
    expect(res.text).toContain('Empire State Building');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/buildings/bld_001/financials/export');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 for unknown building', async () => {
    const res = await request(app)
      .get('/api/buildings/bld_unknown/financials/export')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/analyze-skyline', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/analyze-skyline');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when no image is attached', async () => {
    const res = await request(app)
      .post('/api/analyze-skyline')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });

  it('returns detected buildings when image is attached', async () => {
    // Create a minimal valid JPEG (smallest possible: 2 bytes SOI marker)
    // The mock vision provider doesn't actually read the image, so a tiny buffer works.
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = await request(app)
      .post('/api/analyze-skyline')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('image', fakeJpeg, { filename: 'skyline.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.analysisId).toBeDefined();
    expect(Array.isArray(res.body.detectedBuildings)).toBe(true);
    expect(res.body.detectedBuildings.length).toBeGreaterThan(0);
    expect(res.body.detectedBuildings[0]).toHaveProperty('buildingId');
    expect(res.body.detectedBuildings[0]).toHaveProperty('name');
    expect(res.body.detectedBuildings[0]).toHaveProperty('confidence');
    expect(res.body.processedAt).toBeDefined();
  });
});

describe('POST /api/auth/register', () => {
  const uniqueEmail = `testuser_${Date.now()}@example.com`;

  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail, password: 'securepass123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(uniqueEmail);
    expect(res.body.user.role).toBe('user');
  });

  it('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail, password: 'anotherpass' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'securepass123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const loginEmail = `logintest_${Date.now()}@example.com`;
  const loginPass = 'mypassword456';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: loginEmail, password: loginPass });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: loginPass });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(loginEmail);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for nonexistent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/404', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
