export type AuthorizedCalcResponseJson = {
  result: number;
  operation: 'add' | 'multiply';
};

export class AuthorizedCalcResponse {
  constructor(
    public readonly result: number,
    public readonly operation: string
  ) {}

  static fromJson(json: AuthorizedCalcResponseJson): AuthorizedCalcResponse {
    return new AuthorizedCalcResponse(json.result, json.operation);
  }

  toJson(): AuthorizedCalcResponseJson {
    return { result: this.result, operation: this.operation as 'add' | 'multiply' };
  }
}
