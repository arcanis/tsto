export abstract class Base {
    private built = new Map<() => any, any>();

    build<T>(fn: () => T): T {
        return fn.call(this);
    }
}
