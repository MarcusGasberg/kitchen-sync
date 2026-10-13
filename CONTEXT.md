# Kitchen Sync

An offline-first grocery list. Clients apply changes locally at once and reconcile them with a single authoritative server later.

## Language

**Grocery item**:
Something to buy, with a name, a quantity, an optional unit and category, a checked flag and a position in the list.
_Avoid_: Task, todo, product

**Mutation**:
A client's request to change the grocery list, numbered by its client so the server can recognise redelivery.
_Avoid_: Action, command, operation

**Client mutation id**:
The per-client sequence number of a mutation, starting at 1 with no gaps.
_Avoid_: Sequence number, op id

**Batch**:
The mutations a client sends to the server in one push, in client mutation id order.
_Avoid_: Payload, bundle

**Outbox**:
A client's local list of mutations it has applied optimistically but the server has not yet acknowledged.
_Avoid_: Queue, pending list

**Ack**:
The server's statement that a mutation was applied (or redelivered) and the client must never send it again. A rejected mutation is not acked; it is listed under rejections instead. Either way the client settles its outbox by `lastMutationId`, not by scanning `acked`.
_Avoid_: Confirm, accept

**Rejection**:
A settled mutation the server refused to apply, with a human-readable reason. It consumes its client mutation id.
_Avoid_: Failure, error

**Redelivery**:
A mutation the server has already settled arriving again. It is acked and never decided a second time.
_Avoid_: Duplicate, retry

**Gap**:
A mutation arriving with a client mutation id beyond the next expected one. It is rejected without consuming its id.
_Avoid_: Out-of-order mutation

**Server version**:
The server's counter of how many state-changing mutations it has applied. Each item records the server version that last changed it.
_Avoid_: Revision, sequence

**Poke**:
A notice carrying the latest server version, telling clients to pull.
_Avoid_: Notification, event

**Push**:
A client sending its batch to the server.

**Pull**:
A client asking the server for the current items. A client already at the server version receives none.
_Avoid_: Fetch, sync down
