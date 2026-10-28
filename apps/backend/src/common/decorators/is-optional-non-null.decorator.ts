import { ValidateIf } from "class-validator";

/**
 * Like `@IsOptional()`, but only for an absent field: `undefined` skips
 * validation, while `null` is validated like any other value (and so fails
 * `@IsString()`, `@IsEnum()`, ...). Use it on fields whose column is NOT NULL,
 * where `@IsOptional()` would let `null` through to the database and a 500.
 * Nullable columns that clients clear with `null` keep `@IsOptional()`.
 */
export const IsOptionalNonNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
