export class QwenResponseError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "QwenResponseError";
    this.statusCode = statusCode;
  }
}

export class QwenTimeoutError extends Error {
  constructor(message, statusCode = 408) {
    super(message);
    this.name = "QwenTimeoutError";
    this.statusCode = statusCode;
  }
}
