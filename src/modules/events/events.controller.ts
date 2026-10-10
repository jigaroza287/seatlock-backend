import { type Request, type Response } from 'express';
import type { Event, UpdateEventPayload } from './events.type.js';

const events: Event[] = [];

export function getEvents(_: Request, res: Response) {
  return res.status(200).json({ data: events });
}

export function getEvent(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const eventExists = events.find((event) => {
    return event.id === id;
  });

  if (!eventExists) {
    return res.status(404).json({
      message: `Could not find any event with id`,
    });
  }
  return res.status(200).json({ data: eventExists });
}

export function addEvent(req: Request<{}, {}, Event>, res: Response) {
  const { id, title, description, category, durationMins, language } = req.body;

  if (!title || !description || !category || !durationMins || !language) {
    return res.status(400).json({
      message: `Missing required field(s). All "title", "description", "category", "durationMins" and "language" are mandatory fields`,
    });
  }

  if (!(typeof durationMins === 'number' && durationMins > 0)) {
    return res.status(400).json({
      message: `durationMins should be a positive number`,
    });
  }

  const eventExists = events.some((event) => event.id === id);
  if (eventExists) {
    return res.status(409).json({
      message: `An event with id: ${id} already exists`,
    });
  }

  const event: Event = {
    id,
    title,
    description,
    category,
    durationMins,
    language,
  };
  events.push(event);
  return res.status(201).json({ data: event });
}

export function updateEvent(req: Request<{ id: string }, {}, UpdateEventPayload>, res: Response) {
  const { id } = req.params;
  const updates = req.body;

  const eventIndex = events.findIndex((event) => {
    return event.id === id;
  });

  if (eventIndex === -1) {
    return res.status(404).json({
      message: `Could not find any event with id`,
    });
  }

  if ('id' in updates) {
    return res.status(400).json({
      message: `id field is readonly and cannot be updated`,
    });
  }

  const { durationMins } = updates;
  if (durationMins !== undefined) {
    if (!(typeof durationMins === 'number' && durationMins > 0))
      return res.status(400).json({
        message: `durationMins should be a positive number`,
      });
  }

  const existingEvent = events[eventIndex];
  if (!existingEvent) {
    return res.status(404).json({
      message: `Could not find any event with id`,
    });
  }

  const updatedEvent: Event = {
    ...existingEvent,
    ...updates,
    id: existingEvent.id,
  };
  events[eventIndex] = updatedEvent;
  return res.status(200).json({ data: updatedEvent });
}

export function deleteEvent(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;

  const eventIndex = events.findIndex((event) => {
    return event.id === id;
  });

  if (eventIndex === -1) {
    return res.status(404).json({
      message: `Could not find any event with id`,
    });
  }

  events.splice(eventIndex, 1);

  res.status(204).json({
    message: `Event successfully deleted`,
  });
}
