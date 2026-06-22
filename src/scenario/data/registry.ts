/**
 * Captured data for a step acting as a data handler, keyed by source name.
 *
 * Sources are populated by test modules after a step runs and may be referenced
 * by subsequent steps via the `<handler>.<source>` or
 * `<handler>.<source>$.<jsonPath>` reference syntax.
 */
export interface StepDataRecord {
  /** Named data sources produced by the handler step. */
  sources: Record<string, unknown>;
}

/**
 * Registry of captured step data, keyed by {@link StepData.dataHandlerName}.
 *
 * Enables inter-step value passing: a step declares a `dataHandlerName` and
 * populates named sources; later steps reference those sources via
 * {@link resolveReference}.
 */
class StepDataRegistry {
  private data: Map<string, StepDataRecord> = new Map();

  /**
   * Stores (or replaces) the data record for a handler name.
   *
   * @param name - Handler name (matches {@link StepData.dataHandlerName}).
   * @param record - Captured sources to store.
   */
  set(name: string, record: StepDataRecord): void {
    this.data.set(name, record);
  }

  /**
   * Returns the data record for `name`, or `undefined` when not registered.
   *
   * @param name - Handler name to look up.
   */
  get(name: string): StepDataRecord | undefined {
    return this.data.get(name);
  }

  /**
   * Returns whether a data record exists for `name`.
   *
   * @param name - Handler name to check.
   */
  has(name: string): boolean {
    return this.data.has(name);
  }

  /** Removes all registered data records. */
  clear(): void {
    this.data.clear();
  }
}

/** Singleton instance of {@link StepDataRegistry}. */
export const stepDataRegistry = new StepDataRegistry();
