export class ApiError extends Error {
  code: string

  constructor(message: string, code = 'BAD_REQUEST') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}
