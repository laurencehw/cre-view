import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { signToken, requireAuth } from '../middleware/auth';
import { getDb } from '../db/connection';
import logger from '../services/logger';

export const authRouter = Router();

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  role: string;
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
authRouter.post(
  '/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Invalid input', details: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const db = await getDb();

    // Check if email already exists
    const existing = await db.query<UserRow>(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
      return;
    }

    const id = `usr_${crypto.randomBytes(4).toString('hex')}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    await db.query(
      `INSERT INTO users (id, email, password_hash, salt, role) VALUES ($1, $2, $3, $4, $5)`,
      [id, email, passwordHash, salt, 'user'],
    );

    const token = signToken({ sub: id, email, role: 'user' });
    logger.info({ userId: id, email }, 'User registered');
    res.status(201).json({ token, user: { id, email, role: 'user' } });
  },
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
authRouter.post(
  '/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Invalid input', details: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const db = await getDb();

    const result = await db.query<UserRow>(
      `SELECT id, email, password_hash, salt, role FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
      return;
    }

    const hash = hashPassword(password, user.salt);
    const expected = Buffer.from(user.password_hash, 'hex');
    const actual = Buffer.from(hash, 'hex');

    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
      return;
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    logger.info({ userId: user.id }, 'User logged in');
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  },
);

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Issues a fresh token if the current one is still valid.
// The frontend calls this proactively before the token expires.
authRouter.post(
  '/auth/refresh',
  requireAuth,
  (_req: Request, res: Response) => {
    const user = _req.user!;
    const token = signToken({ sub: user.sub, email: user.email, role: user.role });
    res.json({ token });
  },
);
