/** Opens the browser file picker. Must be called from a user gesture. */
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    };
    input.oncancel = () => {
      resolve([]);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function fileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** JPEG thumbnail (longest side 480px). Returns null when the browser cannot decode the format (e.g. HEIC). */
export async function makeThumbnail(file: File): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), ...out };
  } catch {
    return null;
  }
}

/** Reads EXIF DateTimeOriginal from a JPEG, if present. Returns ISO-like local time without zone. */
export function exifDate(bytes: Uint8Array): string | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 2;
  while (off + 4 < bytes.length) {
    if (bytes[off] !== 0xff) return null;
    const marker = bytes[off + 1]!;
    const len = view.getUint16(off + 2);
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(off + 4, off + 8)) === 'Exif') {
      const text = new TextDecoder('latin1').decode(bytes.slice(off + 10, off + 2 + len));
      const m = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(text);
      return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
    }
    off += 2 + len;
  }
  return null;
}
