interface ClassDecoratorContext<T> {}
interface TemplateStringsArray {}

interface Boolean {}
interface Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}

namespace Cpp {
    /**
     * Represents a C++ pointer type.
     */
    export type Ptr<T> = number & {__cpp: `ptr`, __cpp_ptr: T};

    /**
     * Represents a raw `long long` value.
     */
    export type LL = number & {__cpp: `raw`, __cpp_raw: `long long`};

    /**
     * If declared within a class, must be set to `value` or `reference`.
     * 
     * The compiler will use this information to determine whether to pass
     * the class instance by value or by reference when performing copies,
     * like in function calls.
     */
    export declare const PassBy: unique symbol;
}

namespace Operator {
    export declare const EqualEqual: unique symbol;
    export declare const NotEqual: unique symbol;

    export declare const LessThanEqual: unique symbol;
    export declare const LessThan: unique symbol;

    export declare const GreaterThanEqual: unique symbol;
    export declare const GreaterThan: unique symbol;

    export declare const Substract: unique symbol;
    export declare const Add: unique symbol;
    export declare const Multiply: unique symbol;
    export declare const Divide: unique symbol;
    export declare const Modulo: unique symbol;

    export declare const Unref: unique symbol;
}

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
 * Note that it's a template tag, not a regular function - it means you can
 * safely use it to interpolate values within the raw code.
 * 
 * @example __cpp `std::cout << "Hello world!" << std::endl`;
 * @example __cpp `std::cout << "Hello ${name}!" << std::endl`;
 */
declare const __cpp: ((msg: TemplateStringsArray, ...args: any[]) => any);

/**
 * Represents an integer wrapper. The TsTo compiler will automatically convert
 * all bigint literals into `Int` values.
 */
class Int {
    declare [Cpp.PassBy]: `value`;

    val: Cpp.LL;

    constructor(val: Cpp.LL) {
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

    [Operator.Unref](): Cpp.Ptr<Int> {
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
