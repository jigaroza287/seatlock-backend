import { z } from 'zod';
import type {
  createVenueSchema,
  listVenueQuerySchema,
  updateVenueSchema,
} from './venues.schema.js';

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
export type ListVenuesQuery = z.infer<typeof listVenueQuerySchema>;

// Written out because address is optional on create but always present (or null) in a response.
export type Venue = {
  id: string;
  name: string;
  city: string;
  address: string | null;
};

export type VenueListOutput = { items: Venue[]; total: number };

export interface IVenueRepository {
  findMany(query: ListVenuesQuery): Promise<VenueListOutput>;
  findById(id: string): Promise<Venue | null>;
  create(input: CreateVenueInput): Promise<Venue>;
  update(id: string, changes: UpdateVenueInput): Promise<Venue | null>;
  delete(id: string): Promise<boolean>;
}
