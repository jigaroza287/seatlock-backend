import { Router } from 'express';
import {
  addShow,
  deleteShow,
  getShow,
  getShows,
  getShowSeats,
  updateShow,
} from './shows.controller.js';

const router = Router();

router.get('/', getShows);
router.get('/:id', getShow);
router.get('/:id/seats', getShowSeats);
router.post('/', addShow);
router.patch('/:id', updateShow);
router.delete('/:id', deleteShow);

export { router };
