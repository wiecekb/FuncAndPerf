import type { K6StepGenerator, K6BrowserStepGenerator } from './interface';
import { CalculatorK6Generator } from '../test-modules/calculator/k6';
import { AuthorizedCalculatorK6Generator } from '../test-modules/authorized-calculator/k6';
import { BrowserK6Generator } from '../test-modules/browser/k6';
import { ScenarioType } from '../scenario/types';

/**
 * Registry of k6 step generators, keyed by {@link K6StepGenerator.stepType}.
 *
 * Maintains two maps: one for HTTP/API generators and one for browser
 * generators. Built-in generators are registered below as a module side effect.
 */
class K6StepGeneratorRegistry {
  private generators: Map<string, K6StepGenerator> = new Map<string, K6StepGenerator>();
  private browserGenerators: Map<string, K6BrowserStepGenerator> = new Map<string, K6BrowserStepGenerator>();

  /**
   * Registers (or replaces) an API generator.
   *
   * @param generator - Generator to register.
   */
  register(generator: K6StepGenerator): void {
    this.generators.set(generator.stepType, generator);
  }

  /**
   * Registers (or replaces) a browser generator.
   *
   * @param generator - Browser generator to register.
   */
  registerBrowser(generator: K6BrowserStepGenerator): void {
    this.browserGenerators.set(generator.stepType, generator);
  }

  /**
   * Returns the API generator registered for `stepType`, if any.
   *
   * @param stepType - Step type discriminator to look up.
   */
  get(stepType: string): K6StepGenerator | undefined {
    return this.generators.get(stepType);
  }

  /**
   * Returns whether an API generator is registered for `stepType`.
   *
   * @param stepType - Step type discriminator to check.
   */
  has(stepType: string): boolean {
    return this.generators.has(stepType);
  }
}

/** Singleton instance of {@link K6StepGeneratorRegistry} with built-in generators registered. */
export const k6GeneratorRegistry = new K6StepGeneratorRegistry();

k6GeneratorRegistry.register(new CalculatorK6Generator(ScenarioType.CALCULATOR));
k6GeneratorRegistry.register(new AuthorizedCalculatorK6Generator(ScenarioType.AUTHORIZED_CALCULATOR));
k6GeneratorRegistry.registerBrowser(new BrowserK6Generator(ScenarioType.BROWSER));
