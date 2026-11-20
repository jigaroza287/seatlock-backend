import { Router } from 'express';
import { addShow, deleteShow, getShow, getShows, updateShow } from './shows.controller.js';

const router = Router();

router.get('/', getShows);
router.get('/:id', getShow);
router.post('/', addShow);
router.patch('/:id', updateShow);
router.delete('/:id', deleteShow);

export { router };
