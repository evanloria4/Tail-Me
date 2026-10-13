import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'crypto';
import prisma from '../db';
import supabaseAdmin from '../supabase';

const router = Router();

// Slow down passcode guessing
const passcodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function passcodeMatches(input: unknown): boolean {
  const expected = process.env.SIGNUP_PASSCODE;
  if (!expected || typeof input !== 'string') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Step 1 of signup: check the shared passcode before showing the form. */
router.post('/passcode', passcodeLimiter, (req, res) => {
  if (!passcodeMatches(req.body?.passcode)) {
    res.status(401).json({ error: 'Incorrect passcode' });
    return;
  }
  res.json({ ok: true });
});

/**
 * Step 2: create the Supabase auth account + profile. Signup happens here (not in the
 * browser) so the passcode can't be skipped; public signups are disabled in Supabase.
 */
router.post('/signup', passcodeLimiter, async (req, res) => {
  const { passcode, email, password, username } = req.body ?? {};

  if (!passcodeMatches(passcode)) {
    res.status(401).json({ error: 'Incorrect passcode' });
    return;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Enter a valid email' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-20 letters, numbers or underscores',
    });
    return;
  }

  const taken = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });
  if (taken) {
    res.status(409).json({ error: 'That username is taken' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    const exists = error?.code === 'email_exists';
    res.status(exists ? 409 : 400).json({
      error: exists
        ? 'An account with that email already exists'
        : (error?.message ?? 'Could not create account'),
    });
    return;
  }

  try {
    await prisma.user.create({ data: { id: data.user.id, username } });
  } catch (err) {
    // Don't leave an auth account without a profile
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    throw err;
  }

  res.status(201).json({ ok: true });
});

export default router;
