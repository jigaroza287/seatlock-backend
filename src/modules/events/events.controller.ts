import { type Request, type Response } from 'express';
import { idParamSchema, listQuerySchema } from '../../shared/schema.js';
import type { IdParam } from '../../shared/types.js';
import { createEventSchema, updateEventSchema } from './events.schema.js';
import { eventService } from './events.service.js';
import type { EventListOutput } from './events.type.js';

export async function getEvents(req: Request, res: Response) {
  const input = listQuerySchema.parse(req.query);
  const eventListOutput: EventListOutput = await eventService.list(input);

  return res.status(200).json({
    data: eventListOutput.items,
    pagination: {
      ...input,
      total: eventListOutput.total,
    },
  });
}

export async function getEvent(req: Request<IdParam>, res: Response) {
  const result = idParamSchema.parse(req.params);
  const { id } = result;

  const existingEvent = await eventService.getById(id);
  return res.status(200).json({ data: existingEvent });
}

export async function addEvent(req: Request, res: Response) {
  const input = createEventSchema.parse(req.body);

  const event = await eventService.create(input);
  const location = `/api/events/${event.id}`;
  return res.status(201).location(location).json({ data: event });
}

export async function updateEvent(req: Request<IdParam>, res: Response) {
  const result = updateEventSchema.parse(req.body);
  const updates = result;

  const resultParams = idParamSchema.parse(req.params);
  const { id } = resultParams;

  const updatedEvent = await eventService.update(id, updates);
  res.status(200).json({ data: updatedEvent });
}

export async function deleteEvent(req: Request<IdParam>, res: Response) {
  const resultParams = idParamSchema.parse(req.params);
  const { id } = resultParams;
  await eventService.remove(id);
  res.sendStatus(204);
}
