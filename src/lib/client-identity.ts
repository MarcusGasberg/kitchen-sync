let clientId: string | null = null;
let cachedStorage: Storage | undefined;

export const ensureClientId = (storage: Storage | undefined) => {
  if (cachedStorage !== storage) {
    clientId = null;
    cachedStorage?.removeItem("kitchen-sync/clientId");
    cachedStorage = storage;
  }

  if (clientId) {
    return clientId;
  }
  clientId = storage?.getItem("kitchen-sync/clientId") ?? null;
  if (!clientId) {
    clientId = `${crypto.randomUUID()}`;
    localStorage.setItem("kitchen-sync/clientId", clientId);
  }
  return clientId;
};
