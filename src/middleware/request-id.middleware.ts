import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const MAX_REQUEST_ID_LENGTH = 128;

export function addRequestId(req: Request, res: Response, next: NextFunction) {
  const incomingReqId = req.get('X-Request-Id');
  const requestId =
    incomingReqId && incomingReqId.length <= MAX_REQUEST_ID_LENGTH ? incomingReqId : randomUUID();
  res.locals.requestId = requestId;
  res.set('X-Request-Id', requestId);
  next();
}
