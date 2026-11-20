import { AppError } from '../../shared/app-error.js';
import { showRepository } from './shows.repository.js';
import type {
  CreateShowInput,
  IShowRepository,
  ListShowsQuery,
  Show,
  ShowListOutput,
  UpdateShowInput,
} from './shows.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Show', `Could not find any show with id: ${id}`);
}

export class ShowService {
  constructor(private readonly repository: IShowRepository) {}

  list(listShowsQuery: ListShowsQuery): Promise<ShowListOutput> {
    return this.repository.findMany(listShowsQuery);
  }

  async getById(id: string): Promise<Show> {
    const show = await this.repository.findById(id);
    if (show === null) {
      throw notFound(id);
    }

    return show;
  }

  // No event or screen check here: the repository maps their FK errors to 400.
  create(input: CreateShowInput): Promise<Show> {
    return this.repository.create(input);
  }

  async update(id: string, changes: UpdateShowInput): Promise<Show> {
    const updatedShow = await this.repository.update(id, changes);
    if (updatedShow === null) {
      throw notFound(id);
    }

    return updatedShow;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const showService = new ShowService(showRepository);
