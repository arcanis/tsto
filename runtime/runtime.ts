interface ClassDecoratorContext<T> {}
interface TemplateStringsArray {}

interface Boolean {}
interface Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}

/**
 * Represents a raw C++ type. The compiler will use this type as-is (without
 * adding any dependency towards its source!). The second type parameter is
 * used to fake a TS type for the return value (useful to preserve operators).
 */
declare type Cpp<T extends string, TFake = {}> = TFake & {__cpp: T};

/**
 * If this statement is found inside a function, its literal string argument
 * will be extracted and inserted at the top of the definition file.
 * 
 * @example __cpp_top(`#include <iostream>`);
 */
declare const __cpp_top: <T extends string>(msg: [string] extends [T] ? never : T) => void;

/**
 * If this statement is found inside a function, its literal string argument
 * will be extracted and insert inline within the current function.
 * 
 * @example __cpp(`std::cout << "Hello world!" << std::endl`);
 */
declare const __cpp: ((msg: TemplateStringsArray, ...args: any[]) => any);

declare const Cpp: {
    readonly PassByValue: unique symbol;
};

declare const Operator: {
    readonly EqualEqual: unique symbol;
    readonly NotEqual: unique symbol;

    readonly LessThanEqual: unique symbol;
    readonly LessThan: unique symbol;

    readonly GreaterThanEqual: unique symbol;
    readonly GreaterThan: unique symbol;

    readonly Substract: unique symbol;
    readonly Add: unique symbol;
    readonly Multiply: unique symbol;
    readonly Divide: unique symbol;
    readonly Modulo: unique symbol;

    readonly Unref: unique symbol;
};

class Int {
    declare [Cpp.PassByValue]: true;

    val: Cpp<`long long`, bigint>;

    constructor(val: Cpp<`long long`, bigint>) {
        this.val = val;
    }

    toInt() {
        return this.val;
    }

    [Operator.EqualEqual](other: Int) {
        return this.val === other.val;
    }

    [Operator.NotEqual](other: Int) {
        return this.val !== other.val;
    }

    [Operator.LessThanEqual](other: Int) {
        return this.val <= other.val;
    }

    [Operator.LessThan](other: Int) {
        return this.val < other.val;
    }

    [Operator.GreaterThanEqual](other: Int) {
        return this.val >= other.val;
    }

    [Operator.GreaterThan](other: Int) {
        return this.val > other.val;
    }

    [Operator.Substract](other: Int) {
        return this.val - other.val;
    }

    [Operator.Add](other: Int) {
        return this.val + other.val;
    }

    [Operator.Multiply](other: Int) {
        return this.val * other.val;
    }

    [Operator.Divide](other: Int) {
        return this.val / other.val;
    }

    [Operator.Modulo](other: Int) {
        return this.val % other.val;
    }

    [Operator.Unref](): Cpp<`Int*`, BigInt> {
        return __cpp `this`;
    }
}

class Array<T> {
}

class BigInt {}

class Console {
    log(message: string) {
        __cpp_top(`#include <iostream>`);
        __cpp `std::cout << ${message} << std::endl`;
    }
}

var console = new Console();
