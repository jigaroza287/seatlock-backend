import { randomUUID } from 'crypto';
import { type Request, type Response } from 'express';
import { AppError } from '../../shared/app-error.js';
import type { IdParam } from '../../shared/types.js';
import {
  createEventSchema,
  idParamSchema,
  listQuerySchema,
  updateEventSchema,
} from './events.schema.js';
import type { Event } from './events.type.js';

const events: Event[] = [];

export function getEvents(req: Request, res: Response) {
  listQuerySchema.parse(req.query);
  return res.status(200).json({ data: events });
}

export function getEvent(req: Request<IdParam>, res: Response) {
  const result = idParamSchema.safeParse(req.params);

  if (!result.success) {
    throw AppError.badRequest('Event', 'Invalid id format');
  }

  const { id } = req.params;

  const eventExists = events.find((event) => {
    return event.id === id;
  });

  if (!eventExists) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }
  return res.status(200).json({ data: eventExists });
}

export function addEvent(req: Request, res: Response) {
  const input = createEventSchema.parse(req.body);

  const { title, description, category, durationMins, language } = input;

  const existingEvent = events.find(
    (event) => event.title.toLowerCase() === title.toLocaleLowerCase()
  );
  if (existingEvent) {
    throw AppError.conflict('Event', `Title '${title}' is already used by another event`);
  }

  const id = randomUUID();
  const event: Event = {
    id,
    title,
    description,
    category,
    durationMins,
    language,
  };
  events.push(event);
  const location = `/api/events/${event.id}`;
  return res.status(201).location(location).json({ data: event });
}

export function updateEvent(req: Request<IdParam>, res: Response) {
  const result = updateEventSchema.safeParse(req.body);

  if (!result.success) {
    throw AppError.badRequest('Event', result.error.message);
  }

  const { id } = req.params;
  const updates = result.data;

  if ('id' in updates) {
    throw AppError.badRequest('Event', `id field is readonly and cannot be updated`);
  }

  if (updates.title !== undefined) {
    const newTitle = updates.title.toLowerCase();
    const titleTaken = events.some(
      (event) => event.id !== id && event.title.toLowerCase() === newTitle
    );
    if (titleTaken) {
      throw AppError.conflict('Event', `Title '${updates.title}' is already used by another event`);
    }
  }

  const eventIndex = events.findIndex((event) => {
    return event.id === id;
  });
  const existingEvent = events[eventIndex];
  if (!existingEvent) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }

  const updatedEvent: Event = {
    ...existingEvent,
    ...updates,
    id: existingEvent.id,
  };
  events[eventIndex] = updatedEvent;
  return res.status(200).json({ data: updatedEvent });
}

export function deleteEvent(req: Request<IdParam>, res: Response) {
  const { id } = req.params;

  const eventIndex = events.findIndex((event) => {
    return event.id === id;
  });

  if (eventIndex === -1) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }

  events.splice(eventIndex, 1);

  res.sendStatus(204);
}
