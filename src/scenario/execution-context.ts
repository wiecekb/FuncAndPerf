import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { StepData } from './loader';
import { getStepInstanceKey } from './instances';

interface BrowserInstanceRuntime {
  page: Page;
  context?: BrowserContext;
  ownsContext: boolean;
}

interface StepRuntimeState {
  currentHostRef?: string;
}

export class ScenarioExecutionContext {
  private readonly browserInstances: Map<string, BrowserInstanceRuntime> = new Map();
  private readonly stepStates: Map<string, StepRuntimeState> = new Map();

  constructor(
    private readonly browser: Browser,
    private readonly defaultPage: Page
  ) {}

  getStepInstanceKey(step: StepData): string {
    return getStepInstanceKey(step);
  }

  getStepState(step: StepData): StepRuntimeState {
    const key: string = this.getStepInstanceKey(step);
    let state: StepRuntimeState | undefined = this.stepStates.get(key);
    if (!state) {
      state = {};
      this.stepStates.set(key, state);
    }
    return state;
  }

  setCurrentHostRef(step: StepData, hostRef: string): void {
    this.getStepState(step).currentHostRef = hostRef;
  }

  getCurrentHostRef(step: StepData): string | undefined {
    return this.getStepState(step).currentHostRef;
  }

  async getBrowserPage(step: StepData): Promise<Page> {
    const key: string = this.getStepInstanceKey(step);
    const existing: BrowserInstanceRuntime | undefined = this.browserInstances.get(key);
    if (existing) {
      return existing.page;
    }

    if (!step.stepInstanceName) {
      const runtime: BrowserInstanceRuntime = {
        page: this.defaultPage,
        ownsContext: false,
      };
      this.browserInstances.set(key, runtime);
      return runtime.page;
    }

    const context: BrowserContext = await this.browser.newContext();
    const page: Page = await context.newPage();
    const runtime: BrowserInstanceRuntime = {
      page,
      context,
      ownsContext: true,
    };
    this.browserInstances.set(key, runtime);
    return page;
  }

  async cleanup(): Promise<void> {
    for (const runtime of this.browserInstances.values()) {
      if (!runtime.ownsContext) {
        continue;
      }
      try {
        await runtime.context?.close();
      } catch (error) {
        console.warn(`Failed to close browser context: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this.browserInstances.clear();
    this.stepStates.clear();
  }
}
