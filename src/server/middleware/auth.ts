import { NextFunction, Request, Response } from 'express';
import type { User } from '../../generated/prisma/client';
import { hasAccess } from '../../shared/billing';
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

  // Development only: an admin previewing the regular-user view sends
  // `X-View-As: user` (client lib/viewAs). Never honored in production.
  const viewAsUser =
    process.env.NODE_ENV === 'development' &&
    req.headers['x-view-as'] === 'user';
  req.user = viewAsUser ? { ...user, isAdmin: false } : user;
  next();
}

/** Gate for the admin page's API. Use after requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admins only' });
    return;
  }
  next();
}

/** Gate for posting + the Odds API (`hasAccess`: subscribers, admins, the promo). Use after requireAuth. */
export function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !hasAccess(req.user)) {
    res.status(402).json({ error: 'Subscription required' });
    return;
  }
  next();
}
