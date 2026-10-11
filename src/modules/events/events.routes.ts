import { Router } from 'express';
import { addEvent, deleteEvent, getEvent, getEvents, updateEvent } from './events.controller.js';

const router = Router();

router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/', addEvent);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export { router };
