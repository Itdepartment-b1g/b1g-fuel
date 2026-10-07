/** Safe application errors are raised by business rules and translated by controllers. */
export class ApplicationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class UserError extends ApplicationError {}
export class RoleError extends ApplicationError {}
