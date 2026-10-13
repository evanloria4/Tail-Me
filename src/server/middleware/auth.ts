import { NextFunction, Request, Response } from 'express';
import type { User } from '../../generated/prisma/client';
import prisma from '../db';
import supabaseAdmin from '../supabase';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express types are augmented via namespace
  namespace Express {
    interface Request {
      /** Profile of the signed-in user, set by requireAuth */
      user?: User;
    }
  }
}

/** Verifies the Supabase access token in `Authorization: Bearer <token>` and loads the profile. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Session expired, please sign in again' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!user) {
    // Auth account exists without a profile — only possible if signup was interrupted
    res.status(403).json({ error: 'Account setup incomplete' });
    return;
  }

  req.user = user;
  next();
}

/** Gate for anything that costs us money (Odds API). Use after requireAuth. */
export function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = req.user?.subscriptionStatus;
  if (status !== 'ACTIVE' && status !== 'TRIALING') {
    res.status(402).json({ error: 'Subscription required' });
    return;
  }
  next();
}
