import { Router } from 'express';
import { addVenue, deleteVenue, getVenue, getVenues, updateVenue } from './venues.controller.js';

const router = Router();

router.get('/', getVenues);
router.get('/:id', getVenue);
router.post('/', addVenue);
router.patch('/:id', updateVenue);
router.delete('/:id', deleteVenue);

export { router };
