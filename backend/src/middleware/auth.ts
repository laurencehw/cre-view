import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Lightweight JWT-like auth middleware.
// Uses Node's built-in crypto so there's no external dependency to install.
// When you're ready to move to a production JWT library (e.g. jose), swap out
// the verify/sign functions below.

interface TokenPayload {
  sub: string;       // user id
  email?: string;
  role?: string;
  iat: number;       // issued-at (epoch seconds)
  exp: number;       // expiration (epoch seconds)
}

const ALG = 'HS256';

function getSecret(): string {
  return process.env.JWT_SECRET ?? '';
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresInSeconds = 86400): string {
  const JWT_SECRET = getSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = base64url(Buffer.from(JSON.stringify({ alg: ALG, typ: 'JWT' })));
  const body = base64url(Buffer.from(JSON.stringify(fullPayload)));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest();

  return `${header}.${body}.${base64url(signature)}`;
}

export function verifyToken(token: string): TokenPayload {
  const JWT_SECRET = getSecret();
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest();

  const actualSig = base64urlDecode(sig);

  if (!crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('Invalid signature');
  }

  const payload: TokenPayload = JSON.parse(base64urlDecode(body).toString());

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// Express request extension
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware that requires a valid Bearer token.
 * Attach to any route that needs authentication:
 *
 *   router.get('/protected', requireAuth, handler);
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.status(401).json({
      error: err instanceof Error ? err.message : 'Invalid token',
      code: 'UNAUTHORIZED',
    });
  }
}

/**
 * Optional auth — parses the token if present but doesn't block unauthenticated requests.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(authHeader.slice(7));
    } catch {
      // Token invalid — continue without user context
    }
  }
  next();
}
