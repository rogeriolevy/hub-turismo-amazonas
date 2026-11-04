export class HttpError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[] | undefined>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
