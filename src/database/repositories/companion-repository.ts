import type { Companion } from '../../core/domain/types.ts';
import { companionInputSchema, parseOrThrow, type CompanionInput } from '../../core/domain/validation.ts';
import type { RepoContext } from './base.ts';

export class CompanionRepository {
  private readonly ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.ctx = ctx;
  }

  async list(): Promise<Companion[]> {
    return this.ctx.db.getAllAsync<Companion>(
      'SELECT id, name, relation FROM companions WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE',
      [],
    );
  }

  async forTrip(tripId: string): Promise<Companion[]> {
    return this.ctx.db.getAllAsync<Companion>(
      `SELECT c.id, c.name, c.relation FROM companions c JOIN trip_companions tc ON tc.companion_id = c.id
       WHERE tc.trip_id = ? AND c.deleted_at IS NULL ORDER BY c.name COLLATE NOCASE`,
      [tripId],
    );
  }

  async create(input: CompanionInput): Promise<string> {
    const v = parseOrThrow(companionInputSchema, input);
    const id = this.ctx.newId();
    await this.ctx.db.runAsync('INSERT INTO companions(id, name, relation) VALUES (?, ?, ?)', [id, v.name, v.relation]);
    return id;
  }

  async rename(id: string, input: CompanionInput): Promise<void> {
    const v = parseOrThrow(companionInputSchema, input);
    await this.ctx.db.runAsync('UPDATE companions SET name = ?, relation = ? WHERE id = ?', [v.name, v.relation, id]);
  }

  /** Soft delete keeps history on past journeys. */
  async remove(id: string): Promise<void> {
    await this.ctx.db.runAsync('UPDATE companions SET deleted_at = ? WHERE id = ?', [this.ctx.clock.now(), id]);
  }
}
