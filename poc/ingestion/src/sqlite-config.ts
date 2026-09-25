// Benchmark-only settings, applied to event and schema connections.
export function sqliteConfig() {
  const profile = process.env.POC_SQLITE_PROFILE ?? 'delete-full';
  if (!['delete-full', 'wal-full', 'wal-normal'].includes(profile)) throw new Error(`Invalid SQLite profile: ${profile}`);
  const [journal, synchronous] = profile.toUpperCase().split('-');
  return { profile, journal, synchronous };
}

export const sqlitePragmas = {
  foreign_keys: 'ON', wal_autocheckpoint: 1000,
  fullfsync: 'OFF', checkpoint_fullfsync: 'ON',
  cache_size: -16000, mmap_size: 0, temp_store: 'FILE',
  secure_delete: 'OFF', locking_mode: 'NORMAL', automatic_index: 'ON',
};
