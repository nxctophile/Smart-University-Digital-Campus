/** Multipart upload helper - apiMutate always JSON.stringifies its body, so
 * file uploads (locker documents, profile-edit proofs) go through this
 * instead. Always requires live connectivity, same as payments. */
export async function apiUpload<T>(path: string, fields: Record<string, string>, file: File): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", file);

  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Upload failed");
  }
  return res.json();
}
