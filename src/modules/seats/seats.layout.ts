import type { SeatLayoutRowInput, SeatWithoutId } from './seats.type.js';

export function expandLayout(screenId: string, rows: SeatLayoutRowInput[]): SeatWithoutId[] {
  const seats = rows.flatMap((row) => {
    return Array.from({ length: row.seatCount }, (_, index) => ({
      screenId,
      rowLabel: row.rowLabel,
      seatNumber: index + 1,
      category: row.category,
    }));
  });

  return seats;
}
