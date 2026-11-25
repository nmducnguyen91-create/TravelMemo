/**
 * Holds an exclusive Web Lock for the app's lifetime so two tabs never edit separate in-memory
 * copies of the database (the later write would silently overwrite the earlier one).
 */
export function acquireSingleTabLock(): Promise<boolean> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    void locks.request('travelmemo-db', { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(false);
        return undefined;
      }
      resolve(true);
      return new Promise<void>(() => {}); // held until the tab closes
    });
  });
}
