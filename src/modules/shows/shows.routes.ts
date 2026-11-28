import { Router } from 'express';
import {
  addShow,
  deleteShow,
  getShow,
  getShows,
  getShowSeats,
  getEventShows,
  updateShow,
} from './shows.controller.js';

const router = Router();

router.get('/shows', getShows);
router.get('/shows/:id', getShow);
router.get('/shows/:id/seats', getShowSeats);
router.get('/events/:eventId/shows', getEventShows);
router.post('/shows', addShow);
router.patch('/shows/:id', updateShow);
router.delete('/shows/:id', deleteShow);

export { router };
