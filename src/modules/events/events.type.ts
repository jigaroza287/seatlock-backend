export interface Event {
  id: string;
  title: string;
  description: string;
  category: 'concert' | 'comedy' | 'theatre' | 'sports' | 'movie';
  durationMins: number;
  language: string;
}

export type UpdateEventPayload = Partial<Omit<Event, 'id'>>;
