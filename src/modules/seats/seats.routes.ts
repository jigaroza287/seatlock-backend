import { Router } from 'express';
import { addSeat, deleteSeat, getSeat, getSeats, updateSeat } from './seats.controller.js';

// Mounted at /api: create and list are nested under the screen, single-seat routes are flat.
const router = Router();

router.get('/screens/:screenId/seats', getSeats);
router.post('/screens/:screenId/seats', addSeat);
router.get('/seats/:id', getSeat);
router.patch('/seats/:id', updateSeat);
router.delete('/seats/:id', deleteSeat);

export { router };
