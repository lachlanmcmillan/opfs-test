self.onmessage = async (e) => {
  const { fileHandle, data } = e.data;
  const handle = await fileHandle.createSyncAccessHandle();
  const enc = new TextEncoder();
  const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data);
  await handle.truncate(0);
  await handle.write(bytes, { at: 0 });
  await handle.flush?.();
  await handle.close();
  self.postMessage('ok');
};