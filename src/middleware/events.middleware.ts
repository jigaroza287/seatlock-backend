import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function generateEventId(req: Request, res: Response, next: NextFunction) {
  req.body.id = randomUUID();
  next();
}
