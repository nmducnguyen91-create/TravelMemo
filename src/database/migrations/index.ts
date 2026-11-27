import type { Migration } from '../types.ts';
import { migration0001 } from './0001-initial-schema.ts';
import { migration0002 } from './0002-app-core.ts';
import { migration0003 } from './0003-stamp-region-index.ts';
import { migration0004 } from './0004-sync-outbox.ts';
import { migration0005 } from './0005-visit-date-unknown.ts';

/** Ordered, append-only. */
export const migrations: readonly Migration[] = [migration0001, migration0002, migration0003, migration0004, migration0005];
