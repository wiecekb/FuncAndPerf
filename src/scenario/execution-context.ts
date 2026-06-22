import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { StepData } from './loader';
import { getStepInstanceKey } from './instances';

/** Tracks the Playwright page/context associated with a step instance and whether the context is owned (must be closed). */
interface BrowserInstanceRuntime {
  page: Page;
  context?: BrowserContext;
  ownsContext: boolean;
}

/** Per-step runtime state kept by {@link ScenarioExecutionContext}. */
interface StepRuntimeState {
  currentHostRef?: string;
}

/**
 * Maintains runtime state shared across the steps of a scenario: the current
 * host reference per step instance and the browser pages/contexts allocated to
 * named step instances.
 *
 * A single default page is reused for steps without an explicit
 * {@link StepData.stepInstanceName}; named instances receive their own
 * isolated browser context that is closed during {@link ScenarioExecutionContext.cleanup}.
 */
export class ScenarioExecutionContext {
  private readonly browserInstances: Map<string, BrowserInstanceRuntime> = new Map();
  private readonly stepStates: Map<string, StepRuntimeState> = new Map();

  constructor(
    private readonly browser: Browser,
    private readonly defaultPage: Page
  ) {}

  /**
   * Returns the composite instance key for a step (see {@link getStepInstanceKey}).
   *
   * @param step - Step providing the type and optional instance name.
   */
  getStepInstanceKey(step: StepData): string {
    return getStepInstanceKey(step);
  }

  /**
   * Returns (lazily creating) the mutable runtime state for a step instance.
   *
   * @param step - Step whose state is requested.
   */
  getStepState(step: StepData): StepRuntimeState {
    const key: string = this.getStepInstanceKey(step);
    let state: StepRuntimeState | undefined = this.stepStates.get(key);
    if (!state) {
      state = {};
      this.stepStates.set(key, state);
    }
    return state;
  }

  /**
   * Stores the current host reference for a step instance.
   *
   * @param step - Step whose host reference is being set.
   * @param hostRef - Host alias to remember.
   */
  setCurrentHostRef(step: StepData, hostRef: string): void {
    this.getStepState(step).currentHostRef = hostRef;
  }

  /**
   * Returns the host reference previously stored for a step instance, if any.
   *
   * @param step - Step whose host reference is requested.
   */
  getCurrentHostRef(step: StepData): string | undefined {
    return this.getStepState(step).currentHostRef;
  }

  /**
   * Returns a Playwright page for the step instance, allocating an isolated
   * browser context for named instances and reusing the default page otherwise.
   *
   * @param step - Step requesting a page.
   * @returns Playwright page bound to the step instance.
   */
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

  /**
   * Closes every owned browser context and clears all tracked state.
   *
   * Errors while closing individual contexts are logged but do not abort cleanup.
   */
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
