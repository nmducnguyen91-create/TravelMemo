import type { JournalEntry } from '../../core/domain/types.ts';
import { journalInputSchema, parseOrThrow, type JournalInput } from '../../core/domain/validation.ts';
import { first, type RepoContext } from './base.ts';

interface Row {
  id: string;
  trip_id: string | null;
  visit_id: string | null;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

const toEntry = (r: Row): JournalEntry => ({
  id: r.id,
  tripId: r.trip_id,
  visitId: r.visit_id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class JournalRepository {
  private readonly ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.ctx = ctx;
  }

  async list(filter: { tripId?: string; query?: string } = {}): Promise<JournalEntry[]> {
    const where = ['deleted_at IS NULL'];
    const params: string[] = [];
    if (filter.tripId) {
      where.push('trip_id = ?');
      params.push(filter.tripId);
    }
    const q = filter.query?.trim();
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    const rows = await this.ctx.db.getAllAsync<Row>(
      `SELECT id, trip_id, visit_id, title, body, created_at, updated_at FROM journal_entries
       WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return rows.map(toEntry);
  }

  async get(id: string): Promise<JournalEntry | null> {
    const r = await first<Row>(
      this.ctx.db,
      'SELECT id, trip_id, visit_id, title, body, created_at, updated_at FROM journal_entries WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return r ? toEntry(r) : null;
  }

  async create(input: JournalInput): Promise<string> {
    const v = parseOrThrow(journalInputSchema, input);
    const id = this.ctx.newId();
    const now = this.ctx.clock.now();
    await this.ctx.db.runAsync(
      'INSERT INTO journal_entries(id, trip_id, visit_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, v.tripId, v.visitId, v.title, v.body, now, now],
    );
    return id;
  }

  async update(id: string, input: JournalInput): Promise<void> {
    const v = parseOrThrow(journalInputSchema, input);
    await this.ctx.db.runAsync(
      'UPDATE journal_entries SET trip_id = ?, visit_id = ?, title = ?, body = ?, updated_at = ? WHERE id = ?',
      [v.tripId, v.visitId, v.title, v.body, this.ctx.clock.now(), id],
    );
  }

  async remove(id: string): Promise<void> {
    await this.ctx.db.runAsync('UPDATE journal_entries SET deleted_at = ? WHERE id = ?', [this.ctx.clock.now(), id]);
  }
}
