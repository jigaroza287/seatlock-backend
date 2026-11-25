import type { SeatMap, SeatMapRow, SeatMapSeat, ShowSeatView } from './shows.type.js';

// Groups seats into rows. Expects seats sorted by rowLabel, then seatNumber: a Map keeps
// insertion order, so rows and seats come out in the order the query returned them.
export function toSeatMap(showId: string, showSeats: readonly ShowSeatView[]): SeatMap {
  const rowsMap = new Map<string, SeatMapSeat[]>();

  let available = 0;

  for (const { rowLabel, ...seat } of showSeats) {
    const seats = rowsMap.get(rowLabel) ?? [];

    seats.push(seat);
    rowsMap.set(rowLabel, seats);

    if (seat.status === 'available') {
      available++;
    }
  }

  const rows: SeatMapRow[] = Array.from(rowsMap, ([row, seats]) => ({
    row,
    seats,
  }));

  return {
    showId,
    available,
    rows,
  };
}
