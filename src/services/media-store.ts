/** Binary storage for managed media copies, separate from SQLite metadata. */
export interface MediaStore {
  put(path: string, bytes: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  delete(path: string): Promise<void>;
  list(): Promise<string[]>;
}

export class MemoryMediaStore implements MediaStore {
  readonly files = new Map<string, Uint8Array>();
  async put(path: string, bytes: Uint8Array) {
    this.files.set(path, bytes.slice());
  }
  async get(path: string) {
    return this.files.get(path)?.slice() ?? null;
  }
  async delete(path: string) {
    this.files.delete(path);
  }
  async list() {
    return [...this.files.keys()];
  }
}
