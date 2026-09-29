import { Schema } from "effect";

export const BaseIntent = {
  issuedAt: Schema.DateTimeUtcFromString,
};

export const MutationId = {
  clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
};
