import type { K6StepGenerator, K6BrowserStepGenerator } from './interface';
import { CalculatorK6Generator } from '../test-modules/calculator/k6';
import { AuthorizedCalculatorK6Generator } from '../test-modules/authorized-calculator/k6';
import { BrowserK6Generator } from '../test-modules/browser/k6';
import { ScenarioType } from '../scenario/types';

class K6StepGeneratorRegistry {
  private generators: Map<string, K6StepGenerator> = new Map<string, K6StepGenerator>();
  private browserGenerators: Map<string, K6BrowserStepGenerator> = new Map<string, K6BrowserStepGenerator>();

  register(generator: K6StepGenerator): void {
    this.generators.set(generator.stepType, generator);
  }

  registerBrowser(generator: K6BrowserStepGenerator): void {
    this.browserGenerators.set(generator.stepType, generator);
  }

  get(stepType: string): K6StepGenerator | undefined {
    return this.generators.get(stepType);
  }

  getBrowser(stepType: string): K6BrowserStepGenerator | undefined {
    return this.browserGenerators.get(stepType);
  }

  has(stepType: string): boolean {
    return this.generators.has(stepType);
  }

  hasBrowser(stepType: string): boolean {
    return this.browserGenerators.has(stepType);
  }
}

export const k6GeneratorRegistry = new K6StepGeneratorRegistry();

k6GeneratorRegistry.register(new CalculatorK6Generator(ScenarioType.CALCULATOR));
k6GeneratorRegistry.register(new AuthorizedCalculatorK6Generator(ScenarioType.AUTHORIZED_CALCULATOR));
k6GeneratorRegistry.registerBrowser(new BrowserK6Generator(ScenarioType.BROWSER));
