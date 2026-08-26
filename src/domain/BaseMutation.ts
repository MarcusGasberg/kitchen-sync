import { Schema } from "effect";

export const BaseMutation = {
	clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
	clientId: Schema.String.check(Schema.isUUID(4)),
	issuedAt: Schema.DateTimeUtcFromString,
};
