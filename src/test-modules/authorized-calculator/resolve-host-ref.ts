import {config} from '../../config';
import {resolveHostRef as resolveCommonHostRef} from '../../scenario/loader';
import {escapeJsString} from '../../common/codegen';
import {getStepInstanceKey} from '../../scenario/instances';

interface ContextWithHostRef {
    currentHostRef?: string;
    stepInstanceHostRefs?: Map<string, string>;
}

export function resolveAuthorizedCalcBaseExpr(step: { hostRef?: string; stepType?: string; stepInstanceName?: string }, ctx?: ContextWithHostRef): string {
    const instanceKey: string = getStepInstanceKey({stepType: step.stepType || 'AUTHORIZED_CALCULATOR', stepInstanceName: step.stepInstanceName});
    if (step.hostRef) {
        if (ctx) {
            ctx.currentHostRef = step.hostRef;
            ctx.stepInstanceHostRefs ??= new Map<string, string>();
            ctx.stepInstanceHostRefs.set(instanceKey, step.hostRef);
            return `\${HOSTS['${escapeJsString(step.hostRef)}']}`;
        }
        return '`' + resolveCommonHostRef(step.hostRef, config) + '`';
    }

    const inherited: string | undefined = ctx?.stepInstanceHostRefs?.get(instanceKey) ?? ctx?.currentHostRef;
    if (inherited) {
        return ctx ? `\${HOSTS['${escapeJsString(inherited)}']}` : '`' + resolveCommonHostRef(inherited, config) + '`';
    }

    return '`http://localhost:3000`';
}
