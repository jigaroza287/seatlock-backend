import { Router } from 'express';
import { generateEventId } from '../../middleware/events.middleware.js';
import { addEvent, deleteEvent, getEvent, getEvents, updateEvent } from './events.controller.js';

const router = Router();

router.get('/', getEvents);
router.get('/:id', getEvent);
router.post('/', generateEventId, addEvent);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export { router };
