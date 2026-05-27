import type {K6StepGenerator} from './interface';
import {CalculatorK6Generator} from '../test-modules/calculator/k6';

class K6StepGeneratorRegistry {
    private generators: Map<string, K6StepGenerator> = new Map<string, K6StepGenerator>();

    register(generator: K6StepGenerator): void {
        this.generators.set(generator.stepType, generator);
    }

    get(stepType: string): K6StepGenerator | undefined {
        return this.generators.get(stepType);
    }

    has(stepType: string): boolean {
        return this.generators.has(stepType);
    }

}

export const k6GeneratorRegistry = new K6StepGeneratorRegistry();

k6GeneratorRegistry.register(new CalculatorK6Generator('CALCULATOR'));
