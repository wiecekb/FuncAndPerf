import type {GatlingStepGenerator} from './interface';
import {CalculatorGatlingGenerator} from '../test-modules/calculator/gatling';

class GatlingStepGeneratorRegistry {
    private generators: Map<string, GatlingStepGenerator> = new Map<string, GatlingStepGenerator>();

    register(generator: GatlingStepGenerator): void {
        this.generators.set(generator.stepType, generator);
    }

    get(stepType: string): GatlingStepGenerator | undefined {
        return this.generators.get(stepType);
    }

    has(stepType: string): boolean {
        return this.generators.has(stepType);
    }
}

export const gatlingGeneratorRegistry = new GatlingStepGeneratorRegistry();

gatlingGeneratorRegistry.register(new CalculatorGatlingGenerator('CALCULATOR'));
