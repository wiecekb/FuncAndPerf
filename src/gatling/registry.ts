import type { GatlingStepGenerator } from './interface';
import { CalculatorGatlingGenerator } from '../test-modules/calculator/gatling';
import { AuthorizedCalculatorGatlingGenerator } from '../test-modules/authorized-calculator/gatling';

/**
 * Registry of Gatling step generators, keyed by
 * {@link GatlingStepGenerator.stepType}. Built-in generators are registered
 * below as a module side effect.
 */
class GatlingStepGeneratorRegistry {
  private generators: Map<string, GatlingStepGenerator> = new Map<string, GatlingStepGenerator>();

  /**
   * Registers (or replaces) a generator.
   *
   * @param generator - Generator to register.
   */
  register(generator: GatlingStepGenerator): void {
    this.generators.set(generator.stepType, generator);
  }

  /**
   * Returns the generator registered for `stepType`, if any.
   *
   * @param stepType - Step type discriminator to look up.
   */
  get(stepType: string): GatlingStepGenerator | undefined {
    return this.generators.get(stepType);
  }

  /**
   * Returns whether a generator is registered for `stepType`.
   *
   * @param stepType - Step type discriminator to check.
   */
  has(stepType: string): boolean {
    return this.generators.has(stepType);
  }
}

/** Singleton instance of {@link GatlingStepGeneratorRegistry} with built-in generators registered. */
export const gatlingGeneratorRegistry = new GatlingStepGeneratorRegistry();

gatlingGeneratorRegistry.register(new CalculatorGatlingGenerator('CALCULATOR'));
gatlingGeneratorRegistry.register(new AuthorizedCalculatorGatlingGenerator('AUTHORIZED_CALCULATOR'));
