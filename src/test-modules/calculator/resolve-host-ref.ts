import {escapeJsString} from '../../common/codegen';
import type {StepData} from '../../scenario/loader';

interface ContextWithHostRef {
    currentHostRef?: string;
}
export function resolveCalcBaseExpr(step: StepData, ctx?: ContextWithHostRef): string {
    if (step.hostRef) {
        if (ctx) {
            (ctx as { currentHostRef?: string }).currentHostRef = step.hostRef;
        }
        return `\${HOSTS['${escapeJsString(step.hostRef)}']}`;
    }

    const inherited: string | undefined = ctx?.currentHostRef;
    if (!inherited) {
        const msg:string = `No hostRef for step "${step.stepName || step.stepType}". ` +
            'The first calculator step must have a hostRef.';
        if (ctx) {
            throw new Error(msg);
        }
        return "'unknown'";
    }
    return `\${HOSTS['${escapeJsString(inherited)}']}`;
}
