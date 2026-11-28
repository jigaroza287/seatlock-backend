import { z } from 'zod';
import type { createShowSchema, listShowQuerySchema, updateShowSchema } from './shows.schema.js';

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
export type ListShowsQuery = z.infer<typeof listShowQuerySchema>;
// eventId comes from the path, so it is required here (optional in ListShowsQuery).
export type ListShowsByEventQuery = Pick<ListShowsQuery, 'limit' | 'offset'> & { eventId: string };

// startsAt and endsAt are ISO 8601 strings in UTC. Only the repository works with Date.
// endsAt is derived: startsAt + the event's durationMins. Clients never send it.
export type Show = {
  id: string;
  eventId: string;
  screenId: string;
  startsAt: string;
  endsAt: string;
  priceMinor: number;
};

export type ShowListOutput = { items: Show[]; total: number };

// Clients see only whether a seat can be picked. Reserved and booked are both 'unavailable',
// so the seat map doesn't reveal holds in progress.
export type SeatStatus = 'available' | 'unavailable';

// One seat of a show, as the repository returns it. rowLabel is kept so toSeatMap can group.
export type ShowSeatView = {
  id: string;
  rowLabel: string;
  seatNumber: number;
  category: string;
  status: SeatStatus;
};

// A seat inside a SeatMapRow: rowLabel is dropped because the row already carries it.
export type SeatMapSeat = Omit<ShowSeatView, 'rowLabel'>;

export type SeatMapRow = {
  row: string;
  seats: SeatMapSeat[];
};

export type SeatMap = {
  showId: string;
  available: number;
  rows: SeatMapRow[];
};

export type ShowListingRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  priceMinor: number;
  venueName: string;
  screenName: string;
  available: number;
};

export type ShowListingOutput = { items: ShowListingRow[]; total: number };

export interface IShowRepository {
  findMany(query: ListShowsQuery): Promise<ShowListOutput>;
  findById(id: string): Promise<Show | null>;
  // null when the show does not exist. A show always has at least one seat, see the repository.
  findSeatMap(showId: string): Promise<ShowSeatView[] | null>;
  // The service checks the event exists first; here an unknown event just gives an empty list.
  findShowsByEvent(query: ListShowsByEventQuery): Promise<ShowListingOutput>;
  create(input: CreateShowInput): Promise<Show>;
  update(id: string, changes: UpdateShowInput): Promise<Show | null>;
  delete(id: string): Promise<boolean>;
}
