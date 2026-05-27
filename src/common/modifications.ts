import type {ModifyRequest} from '../scenario/modify';

export type ApplyModifier<T = unknown> = (builder: T, value: string) => void;

class ModifierRegistry {
    private modifiers: Map<string, ApplyModifier> = new Map();

    register<T>(param: string, modifier: ApplyModifier<T>): void {
        this.modifiers.set(param, modifier as ApplyModifier);
    }

    get(param: string): ApplyModifier | undefined {
        return this.modifiers.get(param);
    }

    apply(modifyRequests: ModifyRequest[], builder: unknown): unknown {
        for (const mod of modifyRequests) {
            if ('modifiedParameter' in mod) {
                const param: string = mod.modifiedParameter;
                this.modifiers.get(param)?.(builder, mod.modifiedValue);
            }
        }
        return builder;
    }
}

export const modifierRegistry = new ModifierRegistry();
