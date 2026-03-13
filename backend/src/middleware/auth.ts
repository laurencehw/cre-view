import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../services/logger';
import { supabaseAdmin, supabaseEnabled } from '../services/supabase';

// Lightweight JWT-like auth middleware.
// Supports two modes:
//   1. Supabase Auth — verifies tokens via Supabase's getUser() API
//   2. Custom JWT — uses Node's built-in crypto (fallback when Supabase is not configured)

interface TokenPayload {
  sub: string;       // user id
  email?: string;
  role?: string;
  iat: number;       // issued-at (epoch seconds)
  exp: number;       // expiration (epoch seconds)
}

// ─── Supabase token verification ────────────────────────────────────────────

async function verifySupabaseToken(token: string): Promise<TokenPayload> {
  if (!supabaseAdmin) throw new Error('Supabase not configured');

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(error?.message ?? 'Invalid token');
  }

  return {
    sub: user.id,
    email: user.email,
    role: user.role ?? 'authenticated',
    iat: Math.floor(new Date(user.created_at).getTime() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // Supabase handles expiry; this is nominal
  };
}

// ─── Custom JWT signing & verification ──────────────────────────────────────

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

  // timingSafeEqual throws if buffers differ in length, so guard against that
  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('Invalid signature');
  }

  const payload: TokenPayload = JSON.parse(base64urlDecode(body).toString());

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// ─── Unified verify function ────────────────────────────────────────────────

async function verifyAnyToken(token: string): Promise<TokenPayload> {
  if (supabaseEnabled) {
    return verifySupabaseToken(token);
  }
  return verifyToken(token);
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
 * Automatically uses Supabase or custom JWT verification based on config.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7);

  verifyAnyToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((err) => {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Invalid token',
        code: 'UNAUTHORIZED',
      });
    });
}

/**
 * Optional auth — parses the token if present but doesn't block unauthenticated requests.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  verifyAnyToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((err) => {
      logger.debug('optionalAuth: token verification failed: %s', err instanceof Error ? err.message : err);
      next();
    });
}
