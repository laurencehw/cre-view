import { signToken, verifyToken } from '../auth';

// Set JWT_SECRET for testing
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
});

describe('JWT auth', () => {
  it('signs and verifies a token', () => {
    const token = signToken({ sub: 'user_123', email: 'test@example.com' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user_123');
    expect(payload.email).toBe('test@example.com');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('rejects a tampered token', () => {
    const token = signToken({ sub: 'user_123' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = signToken({ sub: 'user_123' }, -1); // already expired
    expect(() => verifyToken(token)).toThrow('Token expired');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyToken('not.a.valid.jwt.token')).toThrow('Malformed token');
    expect(() => verifyToken('')).toThrow('Malformed token');
  });

  it('includes optional role in payload', () => {
    const token = signToken({ sub: 'user_123', role: 'admin' });
    const payload = verifyToken(token);
    expect(payload.role).toBe('admin');
  });
});
