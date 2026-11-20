import { type Request, type Response } from 'express';
import { idParamSchema } from '../../shared/schema.js';
import type { IdParam } from '../../shared/types.js';
import { createShowSchema, listShowQuerySchema, updateShowSchema } from './shows.schema.js';
import { showService } from './shows.service.js';
import type { ShowListOutput } from './shows.type.js';

export async function getShows(req: Request, res: Response) {
  const input = listShowQuerySchema.parse(req.query);
  const { limit, offset } = input;
  const showListOutput: ShowListOutput = await showService.list(input);

  return res.status(200).json({
    data: showListOutput.items,
    pagination: {
      limit,
      offset,
      total: showListOutput.total,
    },
  });
}

export async function getShow(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);

  const existingShow = await showService.getById(id);
  return res.status(200).json({ data: existingShow });
}

export async function addShow(req: Request, res: Response) {
  const input = createShowSchema.parse(req.body);

  const show = await showService.create(input);
  const location = `/api/shows/${show.id}`;
  return res.status(201).location(location).json({ data: show });
}

export async function updateShow(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const changes = updateShowSchema.parse(req.body);

  const updatedShow = await showService.update(id, changes);
  res.status(200).json({ data: updatedShow });
}

export async function deleteShow(req: Request<IdParam>, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await showService.remove(id);
  res.sendStatus(204);
}
