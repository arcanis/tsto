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

export function assertNodeCheck(node: ts.Node, val: boolean, message: string): asserts val {
    if (!val) {
        throwNodeError(node, message);
    }
}

export function assertNodeNotUndefined<T>(node: ts.Node, val: T | null | undefined, message: string = `Expected value to be defined.`): asserts val is T {
    assertNodeCheck(node, typeof val !== `undefined` && val !== null, message);
}

export function assertCheck(val: boolean, message: string = `Expected value to be defined.`): asserts val {
    if (!val) {
        throw new Error(message);
    }
}

export function assertValue<TIn, TOut extends TIn>(val: TIn, check: (val: TIn) => val is TOut, message: string = `Expected value to be defined.`): asserts val is TOut {
    if (!check(val)) {
        throw new Error(message);
    }
}

export function assertNotUndefined<T>(val: T | null | undefined, message: string = `Expected value to be defined.`): asserts val is T {
    assertCheck(typeof val !== `undefined` && val !== null, message);
}

export function assertReturn<T>(val: T | null | undefined, message: string = `Expected value to be defined.`) {
    assertNotUndefined(val, message);
    return val;
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

export function extractParts(node: ts.TaggedTemplateExpression) {
    const quasis: string[] = [];
    const expressions: ts.Expression[] = [];

    if (ts.isTemplateExpression(node.template)) {
        quasis.push(node.template.head.text);

        for (const span of node.template.templateSpans) {
            expressions.push(span.expression);
            quasis.push(span.literal.text);
        }
    } else if (ts.isNoSubstitutionTemplateLiteral(node.template)) {
        quasis.push(node.template.text);
    }

    return {quasis, expressions};
}

export function isArrayType(typeChecker: ts.TypeChecker, ty: ts.Type): ty is ts.TypeReference {
    return typeChecker.isArrayType(ty);
}

export function isTypeReference(ty: ts.Type): ty is ts.TypeReference {
    return 'typeArguments' in ty;
}

export function isTypeParameter(type: ts.Type): boolean {
    return !!(type.flags & ts.TypeFlags.TypeParameter);
}

export function getDeclarationFromReference(program: ts.Program, sourceFile: ts.SourceFile, reference: string): ts.Declaration | null {
    const typeChecker = program.getTypeChecker();

    // Split the reference and walk through each segment, resolving the symbol as we go.
    const segments = reference.split(`.`);

    let currentSymbol: ts.Symbol | undefined;
    for (const segment of segments) {
        if (!currentSymbol) {
            const exportedSymbols = typeChecker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Value);
            if (!exportedSymbols)
                return null;

            const requestedSymbol = exportedSymbols.find(s => s.name === segment);
            if (!requestedSymbol)
                return null;

            currentSymbol = requestedSymbol;
        } else {
            const typeOfSymbol = typeChecker.getTypeOfSymbol(currentSymbol);

            const requestedSymbol = typeOfSymbol.getProperty(segment);
            if (!requestedSymbol)
                return null;

            currentSymbol = requestedSymbol;
        }
    }

    if (!currentSymbol)
        return null;

    assertNodeNotUndefined(sourceFile, currentSymbol.valueDeclaration, `Expected current symbol to be linked to a declaration.`);
    return currentSymbol.valueDeclaration;
}
