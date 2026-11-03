/** Access PureImage's tightly-packed RGBA storage without copying. */
export function getRawRgbaBuffer(canvas, expectedWidth, expectedHeight) {
  if (!canvas || !Number.isInteger(canvas.width) || !Number.isInteger(canvas.height)) {
    throw new TypeError('Canvas tidak valid: width dan height harus tersedia.');
  }
  const width = expectedWidth ?? canvas.width;
  const height = expectedHeight ?? canvas.height;
  if (canvas.width !== width || canvas.height !== height) {
    throw new Error(`Dimensi canvas tidak sesuai: ${canvas.width}x${canvas.height}, diharapkan ${width}x${height}.`);
  }
  const data = canvas.data;
  if (!(data instanceof Uint8Array) && !Buffer.isBuffer(data)) {
    throw new TypeError('Backend Canvas tidak menyediakan buffer piksel Uint8Array RGBA pada canvas.data.');
  }
  const expectedBytes = width * height * 4;
  if (data.byteLength !== expectedBytes) {
    throw new Error(`Ukuran buffer RGBA tidak valid: ${data.byteLength} byte, diharapkan ${expectedBytes} byte.`);
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/** Wait until Node has flushed a chunk to the writable destination. */
const STREAM_ERROR_STATE = new WeakMap();

function getStreamErrorState(stream) {
  let state = STREAM_ERROR_STATE.get(stream);
  if (!state) {
    state = { error: null };
    // A single listener per stream also consumes the error event that follows
    // a Writable callback(error), preventing an uncaught duplicate event.
    stream.on('error', (error) => { state.error = error; });
    STREAM_ERROR_STATE.set(stream, state);
  }
  return state;
}

export function writeChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    const state = getStreamErrorState(stream);
    if (state.error) { reject(state.error); return; }
    try {
      stream.write(chunk, (error) => {
        const failure = error ?? state.error;
        if (failure) reject(failure);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
