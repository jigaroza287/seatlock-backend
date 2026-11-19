import { type Request, type Response } from 'express';
import { idParamSchema, venueIdParamSchema } from '../../shared/schema.js';
import type { IdParam, VenueIdParam } from '../../shared/types.js';
import { createScreenSchema, listScreenQuerySchema, updateScreenSchema } from './screens.schema.js';
import { screenService } from './screens.service.js';
import type { ScreenListOutput } from './screens.type.js';

export async function getScreens(req: Request<VenueIdParam>, res: Response) {
  const { venueId } = venueIdParamSchema.parse(req.params);
  const input = listScreenQuerySchema.parse(req.query);
  const { limit, offset } = input;
  const screenListOutput: ScreenListOutput = await screenService.list(venueId, input);

  return res.status(200).json({
    data: screenListOutput.items,
    pagination: {
      limit,
      offset,
      total: screenListOutput.total,
    },
  });
}

export async function getScreen(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);

  const screen = await screenService.getById(id);
  return res.status(200).json({ data: screen });
}

export async function addScreen(req: Request<VenueIdParam>, res: Response) {
  const { venueId } = venueIdParamSchema.parse(req.params);
  const input = createScreenSchema.parse(req.body);

  const screen = await screenService.create(venueId, input);
  const location = `/api/screens/${screen.id}`;
  return res.status(201).location(location).json({ data: screen });
}

export async function updateScreen(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const changes = updateScreenSchema.parse(req.body);

  const updatedScreen = await screenService.update(id, changes);
  res.status(200).json({ data: updatedScreen });
}

export async function deleteScreen(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await screenService.remove(id);
  res.sendStatus(204);
}
