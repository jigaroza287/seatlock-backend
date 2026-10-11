import { randomUUID } from 'crypto';
import { type Request, type Response } from 'express';
import type { Event, UpdateEventPayload } from './events.type.js';
import { AppError } from '../../shared/app-error.js';

const events: Event[] = [];

export async function getEvents(_: Request, res: Response) {
  return res.status(200).json({ data: events });
}

export async function getEvent(req: Request, res: Response) {
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
  const { title, description, category, durationMins, language } = req.body;

  if (!title || !description || !category || !durationMins || !language) {
    throw AppError.badRequest(
      'Event',
      `Missing required field(s). All "title", "description", "category", "durationMins" and "language" are mandatory fields`
    );
  }

  if (!(typeof durationMins === 'number' && durationMins > 0)) {
    throw AppError.badRequest('Event', `durationMins should be a positive number`);
  }

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

export function updateEvent(req: Request, res: Response) {
  const { id } = req.params;
  const updates = req.body;

  const eventIndex = events.findIndex((event) => {
    return event.id === id;
  });

  if (eventIndex === -1) {
    throw AppError.notFound('Event', `Could not find any event with id: ${id}`);
  }

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

  const { durationMins } = updates;
  if (durationMins !== undefined) {
    if (!(typeof durationMins === 'number' && durationMins > 0)) {
      throw AppError.badRequest('Event', `durationMins should be a positive number`);
    }
  }

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

export function deleteEvent(req: Request, res: Response) {
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
