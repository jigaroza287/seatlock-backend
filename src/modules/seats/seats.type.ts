import { z } from 'zod';
import type {
  seatCategorySchema,
  createSeatSchema,
  listSeatQuerySchema,
  updateSeatSchema,
} from './seats.schema.js';

export type SeatCategory = z.infer<typeof seatCategorySchema>;
export type CreateSeatInput = z.infer<typeof createSeatSchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
export type ListSeatsQuery = z.infer<typeof listSeatQuerySchema>;

// Written out because screenId comes from the path, not from the create body.
export type Seat = {
  id: string;
  screenId: string;
  rowLabel: string;
  seatNumber: number;
  category: SeatCategory;
};

export type SeatListOutput = { items: Seat[]; total: number };

export interface ISeatRepository {
  findMany(screenId: string, query: ListSeatsQuery): Promise<SeatListOutput>;
  findById(id: string): Promise<Seat | null>;
  create(screenId: string, input: CreateSeatInput): Promise<Seat>;
  update(id: string, changes: UpdateSeatInput): Promise<Seat | null>;
  delete(id: string): Promise<boolean>;
}
