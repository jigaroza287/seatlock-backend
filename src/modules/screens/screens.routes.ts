import { Router } from 'express';
import {
  addScreen,
  deleteScreen,
  getScreen,
  getScreens,
  updateScreen,
} from './screens.controller.js';

// Mounted at /api: create and list are nested under the venue, single-screen routes are flat.
const router = Router();

router.get('/venues/:venueId/screens', getScreens);
router.post('/venues/:venueId/screens', addScreen);
router.get('/screens/:id', getScreen);
router.patch('/screens/:id', updateScreen);
router.delete('/screens/:id', deleteScreen);

export { router };
