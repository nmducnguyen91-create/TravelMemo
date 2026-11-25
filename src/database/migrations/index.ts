import type { Migration } from '../types.ts';
import { migration0001 } from './0001-initial-schema.ts';

/** Ordered, append-only. */
export const migrations: readonly Migration[] = [migration0001];
