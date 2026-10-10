import express, { type NextFunction, type Request, type Response } from 'express';
import { router } from './modules/events/events.routes.js';

export const app = express();
app.use(express.json());
app.use('/api/events', router);
app.get('/api/broken-endpoint', (req: Request, res: Response, next: NextFunction) => {
  // Simulating an unexpected application failure
  try {
    throw new Error('Database connection dropped unexpectedly!');
  } catch (error) {
    next(error);
  }
});
app.use((req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    message: `Cannot ${req.method} the requested endpoint ${req.originalUrl}`,
  });
});
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    message: `Something went wrong with Error: ${error.message}`,
  });
});
