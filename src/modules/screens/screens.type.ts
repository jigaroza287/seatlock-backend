import { z } from 'zod';
import type {
  createScreenSchema,
  listScreenQuerySchema,
  updateScreenSchema,
} from './screens.schema.js';

export type CreateScreenInput = z.infer<typeof createScreenSchema>;
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;
export type ListScreensQuery = z.infer<typeof listScreenQuerySchema>;

// Written out because venueId comes from the path, not from the create body.
export type Screen = {
  id: string;
  venueId: string;
  name: string;
};

export type ScreenListOutput = { items: Screen[]; total: number };

export interface IScreenRepository {
  findMany(venueId: string, query: ListScreensQuery): Promise<ScreenListOutput>;
  findById(id: string): Promise<Screen | null>;
  create(venueId: string, input: CreateScreenInput): Promise<Screen>;
  update(id: string, changes: UpdateScreenInput): Promise<Screen | null>;
  delete(id: string): Promise<boolean>;
}
