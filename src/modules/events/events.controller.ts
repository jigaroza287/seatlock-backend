import { type Request, type Response } from 'express';
import { AppError } from '../../shared/app-error.js';
import { idParamSchema, listQuerySchema } from '../../shared/schema.js';
import type { IdParam } from '../../shared/types.js';
import { eventRepository } from './events.repository.js';
import { createEventSchema, updateEventSchema } from './events.schema.js';
import type { EventListOutput } from './events.type.js';

export function getEvents(req: Request, res: Response) {
  const input = listQuerySchema.parse(req.query);
  const eventListOutput: EventListOutput = eventRepository.findMany(input);

  return res.status(200).json({
    data: eventListOutput.items,
    pagination: {
      ...input,
      total: eventListOutput.total,
    },
  });
}

export function getEvent(req: Request<IdParam>, res: Response) {
  const result = idParamSchema.parse(req.params);
  const { id } = result;

  const existingEvent = eventRepository.findById(id);

  if (!existingEvent) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }
  return res.status(200).json({ data: existingEvent });
}

export function addEvent(req: Request, res: Response) {
  const input = createEventSchema.parse(req.body);
  const { title } = input;

  const existingEvent = eventRepository.findByTitle(title);
  if (existingEvent) {
    throw AppError.conflict('Event', `Title '${title}' is already used by another event`);
  }

  const event = eventRepository.create(input);
  const location = `/api/events/${event.id}`;
  return res.status(201).location(location).json({ data: event });
}

export function updateEvent(req: Request<IdParam>, res: Response) {
  const result = updateEventSchema.parse(req.body);
  const updates = result;

  const resultParams = idParamSchema.parse(req.params);
  const { id } = resultParams;

  if (eventRepository.findById(id) === undefined) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }

  if (updates.title !== undefined) {
    const existingEvent = eventRepository.findByTitle(updates.title);
    if (existingEvent !== undefined && existingEvent.id !== id) {
      throw AppError.conflict('Event', `Title '${updates.title}' is already used by another event`);
    }
  }

  const updatedEvent = eventRepository.update(id, updates);
  if (updateEvent !== undefined) {
    return res.status(200).json({ data: updatedEvent });
  } else {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }
}

export function deleteEvent(req: Request<IdParam>, res: Response) {
  const resultParams = idParamSchema.parse(req.params);
  const { id } = resultParams;
  if (eventRepository.delete(id)) {
    res.sendStatus(204);
  } else {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }
}
