import { AsyncLocalStorage } from "async_hooks";

export const requestStorage = new AsyncLocalStorage();

export function getUserToken() {
  return requestStorage.getStore()?.userToken ?? null;
}

export function extractBearer(req) {
  const h = req.headers?.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
