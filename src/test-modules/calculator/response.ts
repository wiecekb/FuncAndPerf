import type {CalcResponseJson} from './types';


export class CalcResponse {
    private readonly _result: number;
    private readonly _operation: string;

    private constructor(result: number, operation: string) {
        this._result = result;
        this._operation = operation;
    }

    get result(): number {
        return this._result;
    }

    get operation(): string {
        return this._operation;
    }

    static fromJson(json: CalcResponseJson | CalcResponseJson[]): CalcResponse {
        const normalized = Array.isArray(json) ? json[0] : json;
        return new CalcResponse(normalized.result, normalized.operation);
    }

    toJson(): CalcResponseJson {
        return {
            result: this._result,
            operation: this._operation as 'add' | 'multiply'
        };
    }
}
