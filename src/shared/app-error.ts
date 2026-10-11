export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(entity: string, message: string): AppError {
    return new AppError(404, `${entity.toUpperCase()}_NOT_FOUND`, message);
  }

  static badRequest(entity: string, message: string, details?: unknown): AppError {
    return new AppError(400, `${entity.toUpperCase()}_BAD_REQUEST`, message, details);
  }

  static conflict(entity: string, message: string): AppError {
    return new AppError(409, `${entity.toUpperCase()}_CONFLICT`, message);
  }
}
