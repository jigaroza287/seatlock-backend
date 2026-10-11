export type CommonError = {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
};

export type CommonErrorResponse = {
  error: CommonError;
};
