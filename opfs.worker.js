async function getRootDirectory() {
  try {
    const root = await navigator.storage.getDirectory();
    return { root, err: null };
  } catch (error) {
    return { root: null, err: "Error getting OPFS root: " + error.message };
  }
}

self.onmessage = async (e) => {
  const { root, err } = await getRootDirectory();
  if (err) throw new Error("Failed to get root directory: " + err);
  const { path, data } = e.data;
  const fileHandle = await root.getFileHandle(path, { create: true });
  const handle = await fileHandle.createSyncAccessHandle();
  const enc = new TextEncoder();
  const bytes =
    typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  await handle.truncate(0);
  await handle.write(bytes, { at: 0 });
  await handle.flush?.();
  await handle.close();
  self.postMessage("ok");
};
