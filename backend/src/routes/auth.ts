import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { signToken } from '../middleware/auth';
import logger from '../services/logger';

export const authRouter = Router();

// In-memory user store for development.
// In production, replace with database-backed user lookup + bcrypt.
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Seed a default dev user on startup
const DEV_SALT = crypto.randomBytes(16).toString('hex');
const users: StoredUser[] = [
  {
    id: 'usr_dev',
    email: 'dev@creview.local',
    passwordHash: hashPassword('dev123', DEV_SALT),
    salt: DEV_SALT,
    role: 'admin',
  },
];

// ─── POST /api/auth/register ─────────────────────────────────────────────────
authRouter.post(
  '/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 }),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Invalid input', details: errors.array() });
      return;
    }

    const { email, password } = req.body;

    if (users.find((u) => u.email === email)) {
      res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user: StoredUser = {
      id: `usr_${crypto.randomBytes(4).toString('hex')}`,
      email,
      passwordHash: hashPassword(password, salt),
      salt,
      role: 'user',
    };
    users.push(user);

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    logger.info({ userId: user.id, email: user.email }, 'User registered');
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  },
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
authRouter.post(
  '/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Invalid input', details: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
      return;
    }

    const hash = hashPassword(password, user.salt);
    const expected = Buffer.from(user.passwordHash, 'hex');
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
