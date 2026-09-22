export const ensureClientId = (() => {
  let clientId: string | null = null;
  let cachedStorage: Storage | undefined;

  return (storage: Storage | undefined) => {
    if (cachedStorage !== storage) {
      clientId = null;
      cachedStorage?.removeItem("kitchen-sync/clientId");
      cachedStorage = storage;
    }

    if (clientId) {
      return clientId;
    }
    clientId = cachedStorage?.getItem("kitchen-sync/clientId") ?? null;
    if (!clientId) {
      clientId = `${crypto.randomUUID()}`;
      cachedStorage?.setItem("kitchen-sync/clientId", clientId);
    }
    return clientId;
  };
})();

export const nextMutationId = (() => {
  let nextClientMutationId = 0;
  let cachedStorage: Storage | undefined;

  return (storage: Storage | undefined) => {
    if (storage !== cachedStorage) {
      nextClientMutationId = 0;
      cachedStorage?.removeItem("kitchen-sync/mutationId");
      cachedStorage = storage;
    }

    nextClientMutationId = +(
      cachedStorage?.getItem("kitchen-sync/mutationId") ?? "0"
    );

    ++nextClientMutationId;
    cachedStorage?.setItem(
      "kitchen-sync/mutationId",
      `${nextClientMutationId}`,
    );
    return nextClientMutationId;
  };
})();
