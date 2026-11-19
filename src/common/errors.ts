export class NotFoundError extends Error {
  readonly status = 404;
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  readonly status = 422;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
