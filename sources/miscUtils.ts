import path from "path";
import * as ts from "typescript";

export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V) {
    let value = map.get(key);

    if (!value)
        map.set(key, value = create());

    return value;
}

export function throwNodeError(node: ts.Node, message: string): never {
    throw new Error(message);
}

export function assertNode<T extends ts.Node>(val: ts.Node, is: (node: ts.Node) => node is T): asserts val is T {
    if (!is(val)) {
        throwNodeError(val, `Invalid node type.`);
    }
}

export function assertNodeNotUndefined<T>(node: ts.Node, val: T | undefined, message: string = `Expected value to be defined.`): asserts val is T {
    if (typeof val === `undefined`) {
        throwNodeError(node, message);
    }
}

export function assertValue<T>(val: T | undefined, message: string = `Expected value to be defined.`): asserts val is T {
    if (typeof val === `undefined`) {
        throw new Error(message);
    }
}

export function visitNode<T>(val: ts.Node, fn: (node: ts.Node) => T) {
    return fn(val);
}

export function indent(str: string) {
    return str.replace(/^(.+)/gm, `  $1`);
}

export function maybeLine(str: string | null) {
    return str ? `${str}\n` : ``;
}

export function maybeNewline(str: string) {
    return str.length > 0 && !str.endsWith(`\n\n`) ? `\n` : ``;
}

export function sortByMap<T>(values: Iterable<T>, mappers: ((value: T) => string) | Array<(value: T) => string>) {
    const asArray = Array.from(values);
  
    if (!Array.isArray(mappers))
        mappers = [mappers];
  
    const stringified: Array<Array<string>> = [];
  
    for (const mapper of mappers)
        stringified.push(asArray.map(value => mapper(value)));
  
    const indices = asArray.map((_, index) => index);
  
    indices.sort((a, b) => {
        for (const layer of stringified) {
            const comparison = layer[a] < layer[b] ? -1 : layer[a] > layer[b] ? +1 : 0;
  
            if (comparison !== 0) {
                return comparison;
            }
        }
  
        return 0;
    });
  
    return indices.map(index => {
        return asArray[index];
    });
}

export function getCommonPathPrefix(paths: string[]) {
    let prefix = paths[0].split(path.sep);
    prefix.pop();

    for (let t = 1; t < paths.length; t++) {
        const parts = paths[t].split(path.sep);
        parts.pop();

        for (let i = 0; i < prefix.length; i++) {
            if (prefix[i] !== parts[i]) {
                prefix = prefix.slice(0, i);
                break;
            }
        }
    }

    return prefix.join(path.sep);
}
