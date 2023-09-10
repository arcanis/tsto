export abstract class Base {
    private built = new Map<() => any, any>();

    build<T>(fn: () => T): T {
        let entry = this.built.get(fn);

        if (typeof entry === `undefined`)
            this.built.set(fn, entry = fn.call(this));

        return entry;
    }
}
