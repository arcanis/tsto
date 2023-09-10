import * as ts from 'typescript';

import { Class } from "./tsto/Class";
import { Function } from "./tsto/Function";
import { Global } from "./tsto/Global";
import * as miscUtils from "./miscUtils";
import { Compiler } from './Compiler';
import path from 'path';

export class UnitContext {
    classes = new Map<ts.ClassDeclaration, Class>();
    functions = new Map<ts.FunctionDeclaration, Function>();
    globals = new Map<ts.VariableDeclaration, Global>();

    constructor(public context: Context, public sourceFile: ts.SourceFile) {
    }

    getRelativePath() {
        const sourcePath = this.sourceFile.fileName;
        const relativePath = path.relative(this.context.rootDir, sourcePath.replace(/\.ts$/, ``));

        return relativePath;
    }

    getClass(classNode: ts.ClassDeclaration) {
        return miscUtils.getOrCreate(this.classes, classNode, () => new Class(this.context, classNode));
    }

    getFunction(functionNode: ts.FunctionDeclaration) {
        return miscUtils.getOrCreate(this.functions, functionNode, () => new Function(this.context, functionNode));
    }

    getGlobal(globalNode: ts.VariableDeclaration) {
        return miscUtils.getOrCreate(this.globals, globalNode, () => new Global(this.context, globalNode));
    }

    generateHeader() {
        let result = `#pragma once\n\n`;

        for (const global of this.globals.values())
            result += miscUtils.maybeLine(global.build(global.declaration));

        result += miscUtils.maybeNewline(result);

        for (const fn of this.functions.values())
            result += miscUtils.maybeLine(`${fn.build(fn.signature)};\n`);

        return result;
    }

    generateSource() {
        let result = ``;

        for (const global of this.globals.values())
            result += miscUtils.maybeLine(global.build(global.generate));

        result += miscUtils.maybeNewline(result);

        for (const fn of this.functions.values())
            result += miscUtils.maybeLine(fn.build(fn.generate));

        return result;
    }
}

function isTopLevelVariableDeclaration(node: ts.VariableDeclaration) {
    return ts.isVariableDeclaration(node) && ts.isSourceFile(node.parent.parent.parent);
}

export class Context {
    compiler = new Compiler(this);
    units = new Map<ts.SourceFile, UnitContext>();

    constructor(public program: ts.Program, public rootDir: string) {
    }

    activate(node: ts.Node) {
        const sym = this.program.getTypeChecker()
            .getSymbolAtLocation(node);

        miscUtils.assertNodeNotUndefined(node, sym, `Expected this node to have a resolved symbol.`);
        miscUtils.assertNodeNotUndefined(node, sym.declarations, `Expected this node to have a linked declaration.`);

        const varDeclaration = sym.declarations.find((decl): decl is ts.VariableDeclaration => ts.isVariableDeclaration(decl));
        if (varDeclaration) {
            if (isTopLevelVariableDeclaration(varDeclaration)) {
                return this.getUnit(varDeclaration.getSourceFile()).getGlobal(varDeclaration);
            } else {
                return;
            }
        }

        const classDeclaration = sym.declarations.find((decl): decl is ts.ClassDeclaration => ts.isClassDeclaration(decl));
        if (classDeclaration)
            return this.getUnit(classDeclaration.getSourceFile()).getClass(classDeclaration);
    
        const fnDeclaration = sym.declarations.find((decl): decl is ts.FunctionDeclaration => ts.isFunctionDeclaration(decl) && !!decl.body);
        if (fnDeclaration)
            return this.getUnit(fnDeclaration.getSourceFile()).getFunction(fnDeclaration);

        const mtdDeclaration = sym.declarations.find((decl): decl is ts.MethodDeclaration => ts.isMethodDeclaration(decl) && !!decl.body);
        miscUtils.assertNodeNotUndefined(node, mtdDeclaration, `Expected callee to have a function definition.`);

        if (ts.isClassDeclaration(mtdDeclaration.parent))
            return this.getUnit(mtdDeclaration.getSourceFile()).getClass(mtdDeclaration.parent).getMethod(mtdDeclaration);

        miscUtils.throwNodeError(node, `Unsupported declaration type ${ts.SyntaxKind[mtdDeclaration.kind]}.`);
    }

    getUnit(sourceFile: ts.SourceFile) {
        return miscUtils.getOrCreate(this.units, sourceFile, () => new UnitContext(this, sourceFile));
    }

    compileType(type: ts.Type): string {
        const typeChecker = this.program.getTypeChecker();

        if (type === typeChecker.getBigIntType())
            return `unsigned long long`;
        if (type === typeChecker.getNumberType())
            return `double`;
        if (type === typeChecker.getStringType())
            return `std::string`;
        if (type === typeChecker.getBooleanType())
            return `bool`;
        if (type === typeChecker.getVoidType())
            return `void`;

        if (type.isUnion()) {
            if (type.types.length === 2) {
                const [a, b] = type.types;
                if (a === typeChecker.getUndefinedType() || b === typeChecker.getUndefinedType()) {
                    const other = a === typeChecker.getUndefinedType() ? b : a;
                    return `std::optional<${this.compileType(other)}>`;
                }
            }
        }

        if (type.isClass()) {
            const symbol = type.getSymbol();
            miscUtils.assertValue(symbol);

            const decl = symbol.declarations!.find((decl): decl is ts.ClassDeclaration => ts.isClassDeclaration(decl));
            miscUtils.assertValue(decl);

            this.getUnit(decl.getSourceFile()).getClass(decl);
            return `${symbol.name}`;
        }

        throw new Error(`Unsupported type ${typeChecker.typeToString(type)}.`);
    }

    compile(statements: ts.NodeArray<ts.Statement>) {
        let result = ``;

        for (const statement of statements)
            result += this.compiler.compile(statement);

        return result;
    }
}
