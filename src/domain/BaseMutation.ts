import { Schema } from "effect";

export const BaseIntent = {
  clientId: Schema.String.check(Schema.isUUID(4)),
  issuedAt: Schema.DateTimeUtcFromString,
};

export const MutationId = {
  clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
};
