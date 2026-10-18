import dotenv from 'dotenv';
import app from './app';
import { startGrader } from './grading';

dotenv.config();

const PORT: number = parseInt(process.env.PORT ?? '', 10) || 8080;

if (PORT) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`listening on localhost:${PORT}`);
  });
  // Auto-grades finished games' bets (set DISABLE_GRADER=true to turn off)
  startGrader();
}
