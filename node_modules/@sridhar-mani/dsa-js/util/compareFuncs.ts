export default class ComparerFunc<T> {
    private readonly compare: (a: T, b: T) => number;

    constructor(compare?: (a: T, b: T) => number) {
        this.compare = compare || ComparerFunc.defaultCompareFunc;
    }

    private static defaultCompareFunc<T>(a: T, b: T): number {
        if (a === b) return 0;
        return a < b ? -1 : 1;
    }

    public equal(a: T, b: T): boolean {
        return this.compare(a, b) === 0;
    }

    public lessThan(a: T, b: T): boolean {
        return this.compare(a, b) < 0;
    }

    public greaterThan(a: T, b: T): boolean {
        return this.compare(a, b) > 0;
    }

    public lessThanOrEqual(a: T, b: T): boolean {
        return this.compare(a, b) <= 0;
    }

    public greaterThanOrEqual(a: T, b: T): boolean {
        return this.compare(a, b) >= 0;
    }

    public reverseCom():ComparerFunc<T>{
        return new ComparerFunc<T>((a,b)=>this.compare(b,a))
    }
}