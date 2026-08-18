import { put as vercelPut, del as vercelDel, copy as vercelCopy } from "@vercel/blob";

// The project's Blob store env vars are prefixed (PUBLICBLOB_*) instead of
// the SDK's default names, because a second (private, unusable) store is
// still connected under the default "BLOB" prefix - see cards.ts/messages.ts
// history. Centralizing the token here means every call site stays a plain
// put()/del()/copy() without repeating this override.
const token = process.env.PUBLICBLOB_READ_WRITE_TOKEN;

export function put(
  pathname: string,
  body: Parameters<typeof vercelPut>[1],
  options: Parameters<typeof vercelPut>[2]
): ReturnType<typeof vercelPut> {
  return vercelPut(pathname, body, { ...options, token });
}

export function del(
  urlOrPathname: Parameters<typeof vercelDel>[0],
  options?: Parameters<typeof vercelDel>[1]
): ReturnType<typeof vercelDel> {
  return vercelDel(urlOrPathname, { ...options, token });
}

export function copy(
  fromUrlOrPathname: string,
  toPathname: string,
  options: Parameters<typeof vercelCopy>[2]
): ReturnType<typeof vercelCopy> {
  return vercelCopy(fromUrlOrPathname, toPathname, { ...options, token });
}
