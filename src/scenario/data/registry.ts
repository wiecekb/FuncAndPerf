export interface StepDataRecord {
  sources: Record<string, unknown>;
}

class StepDataRegistry {
  private data: Map<string, StepDataRecord> = new Map();

  set(name: string, record: StepDataRecord): void {
    this.data.set(name, record);
  }

  get(name: string): StepDataRecord | undefined {
    return this.data.get(name);
  }

  has(name: string): boolean {
    return this.data.has(name);
  }

  clear(): void {
    this.data.clear();
  }
}

export const stepDataRegistry = new StepDataRegistry();
