import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT: number = parseInt(process.env.PORT ?? '', 10) || 8080;

if (PORT) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`listening on localhost:${PORT}`)
  })
}