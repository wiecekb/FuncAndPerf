export class AuthorizedCalcRequestBuilder {
  private _a: number = 0;
  private _b: number = 0;

  withA(value: number): this {
    this._a = value;
    return this;
  }

  withB(value: number): this {
    this._b = value;
    return this;
  }

  build(): Record<string, number> {
    return { a: this._a, b: this._b };
  }
}
