export class AuthorizedCalcRequestBuilder {
    private a: number = 0;
    private b: number = 0;

    setA(value: number): void {
        this.a = value;
    }

    setB(value: number): void {
        this.b = value;
    }

    build(): Record<string, number> {
        return {a: this.a, b: this.b};
    }
}
