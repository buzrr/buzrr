import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/**
 * Validates a body against a `@buzrr/contract` schema, so the REST shape the
 * web client is typed against and the one the server enforces are the same
 * definition. Returns the parsed (defaulted, trimmed) value.
 *
 * Endpoints still on class-validator DTOs keep working: the global
 * ValidationPipe skips parameters whose type is a plain object type.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((issue) =>
          issue.path.length > 0
            ? `${issue.path.join(".")}: ${issue.message}`
            : issue.message,
        ),
      );
    }
    return result.data;
  }
}
