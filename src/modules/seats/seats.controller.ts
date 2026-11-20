import { type Request, type Response } from 'express';
import { idParamSchema, screenIdParamSchema } from '../../shared/schema.js';
import type { IdParam, ScreenIdParam } from '../../shared/types.js';
import {
  createSeatSchema,
  listSeatQuerySchema,
  seatLayoutSchema,
  updateSeatSchema,
} from './seats.schema.js';
import { seatService } from './seats.service.js';
import type { SeatListOutput } from './seats.type.js';

export async function getSeats(req: Request<ScreenIdParam>, res: Response) {
  const { screenId } = screenIdParamSchema.parse(req.params);
  const input = listSeatQuerySchema.parse(req.query);
  const { limit, offset } = input;
  const seatListOutput: SeatListOutput = await seatService.list(screenId, input);

  return res.status(200).json({
    data: seatListOutput.items,
    pagination: {
      limit,
      offset,
      total: seatListOutput.total,
    },
  });
}

export async function getSeat(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);

  const seat = await seatService.getById(id);
  return res.status(200).json({ data: seat });
}

export async function addSeat(req: Request<ScreenIdParam>, res: Response) {
  const { screenId } = screenIdParamSchema.parse(req.params);
  const input = createSeatSchema.parse(req.body);

  const seat = await seatService.create(screenId, input);
  const location = `/api/seats/${seat.id}`;
  return res.status(201).location(location).json({ data: seat });
}

export async function updateSeat(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const changes = updateSeatSchema.parse(req.body);

  const updatedSeat = await seatService.update(id, changes);
  res.status(200).json({ data: updatedSeat });
}

export async function deleteSeat(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await seatService.remove(id);
  res.sendStatus(204);
}

export async function addSeatLayout(req: Request<ScreenIdParam>, res: Response) {
  const { screenId } = screenIdParamSchema.parse(req.params);
  const input = seatLayoutSchema.parse(req.body);

  const createdCount = await seatService.generateLayout(screenId, input);
  return res.status(201).json({ data: { screenId, createdCount } });
}
