import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'path';
import authRouter from './routes/auth';
import meRouter from './routes/me';
import metaRouter from './routes/meta';
import oddsRouter from './routes/odds';
import postsRouter from './routes/posts';
import usersRouter from './routes/users';
import socialRouter from './routes/social';
import communityRouter from './routes/community';
import seriesRouter from './routes/series';

const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist');

const app = express();

// Behind the webpack proxy / hosting proxy, so rate limiting sees the real IP
app.set('trust proxy', 1);

// Security headers; the browser talks to Supabase directly (auth + storage)
const supabaseUrl = process.env.SUPABASE_URL ?? '';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        connectSrc: [
          "'self'",
          supabaseUrl,
          supabaseUrl.replace(/^https/, 'wss'),
        ],
        imgSrc: ["'self'", 'data:', 'blob:', supabaseUrl],
      },
    },
  })
);

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/meta', metaRouter);
app.use('/api/posts', postsRouter);
app.use('/api/users', usersRouter);
app.use('/api/community', communityRouter);
// Tailers, reactions, comments: /api/posts/:id/... and /api/comments/:id/...
app.use('/api', socialRouter);
// Series: /api/users/:username/series and /api/series/...
app.use('/api', seriesRouter);
app.use('/api/odds', oddsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(DIST_DIR));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Express 5 forwards rejected promises from async handlers here (needs all 4 params)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;
