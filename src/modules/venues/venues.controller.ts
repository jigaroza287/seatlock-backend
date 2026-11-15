import { type Request, type Response } from 'express';
import { idParamSchema } from '../../shared/schema.js';
import type { IdParam } from '../../shared/types.js';
import { createVenueSchema, listVenueQuerySchema, updateVenueSchema } from './venues.schema.js';
import { venueService } from './venues.service.js';
import type { VenueListOutput } from './venues.type.js';

export async function getVenues(req: Request, res: Response) {
  const input = listVenueQuerySchema.parse(req.query);
  const { limit, offset } = input;
  const venueListOutput: VenueListOutput = await venueService.list(input);

  return res.status(200).json({
    data: venueListOutput.items,
    pagination: {
      limit,
      offset,
      total: venueListOutput.total,
    },
  });
}

export async function getVenue(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);

  const venue = await venueService.getById(id);
  return res.status(200).json({ data: venue });
}

export async function addVenue(req: Request, res: Response) {
  const input = createVenueSchema.parse(req.body);

  const venue = await venueService.create(input);
  const location = `/api/venues/${venue.id}`;
  return res.status(201).location(location).json({ data: venue });
}

export async function updateVenue(req: Request<IdParam>, res: Response) {
  const changes = updateVenueSchema.parse(req.body);
  const { id } = idParamSchema.parse(req.params);

  const updatedVenue = await venueService.update(id, changes);
  res.status(200).json({ data: updatedVenue });
}

export async function deleteVenue(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await venueService.remove(id);
  res.sendStatus(204);
}
