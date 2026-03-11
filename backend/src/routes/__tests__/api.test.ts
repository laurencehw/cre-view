import request from 'supertest';
import app from '../../index';

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
  it('returns financial data for a building', async () => {
    const res = await request(app).get('/api/buildings/bld_001/financials');
    expect(res.status).toBe(200);
    expect(res.body.buildingId).toBe('bld_001');
    expect(res.body.valuation).toBeDefined();
    expect(res.body.debt).toBeDefined();
    expect(res.body.equity).toBeDefined();
    expect(Array.isArray(res.body.equity.capTable)).toBe(true);
  });

  it('returns 404 for unknown building financials', async () => {
    const res = await request(app).get('/api/buildings/bld_unknown/financials');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/404', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
