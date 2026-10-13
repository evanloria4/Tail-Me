import express from 'express';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist');

const app = express();

app.use(express.json());
app.use(express.static(DIST_DIR));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

export default app;
