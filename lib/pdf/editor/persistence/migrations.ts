/**
 * Migration runner for persisted envelopes.
 *
 * A migration is a pure function that upgrades a payload from version `N` to
 * `N+1`. `migratePersisted` chains them from the stored version up to
 * {@link CURRENT_SCHEMA_VERSION}. This keeps loading forward-compatible: we can
 * change the model freely as long as we add the matching step here.
 *
 * There are no migrations yet (current version is 1). The example below shows
 * the intended shape for when version 2 lands.
 */
import { CURRENT_SCHEMA_VERSION, type PersistedDocument } from "./schema";

/** Upgrades a raw payload from `version` to `version + 1`. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the *source* version each migration upgrades from. */
export const migrations: Record<number, Migration> = {
  // Example (enable when CURRENT_SCHEMA_VERSION becomes 2):
  // 1: (data) => ({
  //   ...data,
  //   schemaVersion: 2,
  //   document: addFieldIntroducedInV2(data.document),
  // }),
};

export class MigrationError extends Error {
  constructor(from: number, to: number) {
    super(`No migration path from schema v${from} to v${to}`);
    this.name = "MigrationError";
  }
}

/**
 * Bring a persisted document up to the current schema version. Throws
 * {@link MigrationError} if a step is missing (e.g. a file from a *newer* app).
 */
export function migratePersisted(data: PersistedDocument): PersistedDocument {
  let current: Record<string, unknown> = { ...data };
  let version = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new MigrationError(version, CURRENT_SCHEMA_VERSION);
    current = migrate(current);
    version += 1;
    current.schemaVersion = version;
  }

  return current as unknown as PersistedDocument;
}

/** True when the payload is from this exact app version (no migration needed). */
export function isCurrentSchema(data: { schemaVersion?: number }): boolean {
  return data.schemaVersion === CURRENT_SCHEMA_VERSION;
}
