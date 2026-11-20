import { z } from 'zod';
import type { createShowSchema, listShowQuerySchema, updateShowSchema } from './shows.schema.js';

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
export type ListShowsQuery = z.infer<typeof listShowQuerySchema>;

// startsAt is an ISO 8601 string in UTC. Only the repository works with Date.
export type Show = {
  id: string;
  eventId: string;
  screenId: string;
  startsAt: string;
  priceMinor: number;
};

export type ShowListOutput = { items: Show[]; total: number };

export interface IShowRepository {
  findMany(query: ListShowsQuery): Promise<ShowListOutput>;
  findById(id: string): Promise<Show | null>;
  create(input: CreateShowInput): Promise<Show>;
  update(id: string, changes: UpdateShowInput): Promise<Show | null>;
  delete(id: string): Promise<boolean>;
}
