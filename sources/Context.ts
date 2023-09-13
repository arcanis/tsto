import * as ts from 'typescript';

import { Class } from "./tsto/Class";
import { Function } from "./tsto/Function";
import { Global } from "./tsto/Global";
import * as miscUtils from "./miscUtils";
import { Compiler } from './Compiler';
import path from 'path';
import { Struct } from './tsto/Struct';

export class UnitContext {
    compiler = new Compiler(this.context, this);
    top = new Set<string>();

    classes = new Map<ts.ClassDeclaration, Class>();
    functions = new Map<ts.FunctionDeclaration, Function>();
    globals = new Map<ts.VariableDeclaration, Global>();
    structs = new Map<ts.InterfaceDeclaration, Struct>();

    absoluteFolder: string;
    absolutePath: string;

    constructor(public context: Context, public sourceFile: ts.SourceFile) {
        this.absolutePath = sourceFile.fileName.replace(/\.ts$/, ``);
        this.absoluteFolder = path.dirname(this.absolutePath);
    }

    addDependency(unit: UnitContext) {
        const includePath = path.relative(this.absoluteFolder, unit.absolutePath);
        this.top.add(`#include "${includePath}.h"`);
    }

    addRuntimeDependency<T>(selector: string, check?: {new(...args: any[]): T}) {
        const runtime = this.context.getRuntimeUnit();
        this.addDependency(runtime);

        const decl = miscUtils.getDeclarationFromReference(this.context.program, runtime.sourceFile, selector);
        miscUtils.assertNotUndefined(decl, `Expected the runtime to have a declaration for ${selector}.`);

        const entry = this.context.activate(decl);
        if (check && !(entry instanceof check))
            throw new Error(`Expected ${selector} to be a ${check.name}.`);

        return entry as T;
    }

    activateWithDependency(node: ts.Node) {
        const result = this.context.activate(node);

        if (result)
            this.addDependency(result.unit);

        return result;
    }

    getClass(classNode: ts.ClassDeclaration) {
        return miscUtils.getOrCreate(this.classes, classNode, () => new Class(this.context, this, classNode));
    }

    getFunction(functionNode: ts.FunctionDeclaration) {
        return miscUtils.getOrCreate(this.functions, functionNode, () => new Function(this.context, this, functionNode));
    }

    getGlobal(globalNode: ts.VariableDeclaration) {
        return miscUtils.getOrCreate(this.globals, globalNode, () => new Global(this.context, this, globalNode));
    }

    getStruct(structNode: ts.InterfaceDeclaration) {
        return miscUtils.getOrCreate(this.structs, structNode, () => new Struct(this.context, this, structNode));
    }

    generateHeader() {
        this.top = new Set();

        let result = ``;

        for (const struct of this.structs.values())
            result += miscUtils.maybeLine(struct.signature());

        result += miscUtils.maybeNewline(result);

        for (const klass of this.classes.values())
            result += miscUtils.maybeLine(klass.generateDeclaration());

        result += miscUtils.maybeNewline(result);

        for (const fn of this.functions.values())
            result += miscUtils.maybeLine(fn.generateDeclaration());

        result += miscUtils.maybeNewline(result);

        for (const global of this.globals.values())
            result += miscUtils.maybeLine(global.declaration());

        let top = ``;

        const topEntries = [...this.top.values()].sort();
        for (const entry of topEntries)
            top += miscUtils.maybeLine(entry);

        top += miscUtils.maybeNewline(top);

        return `#pragma once\n\n` + top + result;
    }

    generateSource() {
        this.top = new Set();
        this.top.add(`#include "${path.basename(this.absolutePath)}.h"`);

        let result = ``;

        for (const klass of this.classes.values())
            result += miscUtils.maybeLine(klass.generateDefinition());

        result += miscUtils.maybeNewline(result);

        for (const fn of this.functions.values())
            result += miscUtils.maybeLine(fn.generateDefinition());

        result += miscUtils.maybeNewline(result);

        for (const global of this.globals.values())
            result += miscUtils.maybeLine(global.generate());

        let top = ``;

        const topEntries = [...this.top.values()].sort();
        for (const entry of topEntries)
            top += miscUtils.maybeLine(entry);

        top += miscUtils.maybeNewline(top);

        return top + result;
    }
}

function isTopLevelVariableDeclaration(node: ts.VariableDeclaration) {
    return ts.isVariableDeclaration(node) && ts.isSourceFile(node.parent.parent.parent);
}

export class Context {
    units = new Map<ts.SourceFile, UnitContext>();
    operators = new Map<ts.Declaration, string>();

    constructor(public program: ts.Program) {
        const runtimePath = path.resolve(__dirname, `../runtime/runtime.ts`);

        const sourceFile = this.program.getSourceFile(runtimePath);
        miscUtils.assertNotUndefined(sourceFile, `Expected the runtime to be loaded.`);

        this.operators = new Map([
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.EqualEqual`)), `operator==`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.NotEqual`)), `operator!=`],

            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.LessThan`)), `operator<`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.LessThanEqual`)), `operator<=`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.GreaterThan`)), `operator>`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.GreaterThanEqual`)), `operator>=`],

            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Substract`)), `operator-`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Add`)), `operator+`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Multiply`)), `operator*`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Divide`)), `operator/`],
            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Modulo`)), `operator%`],

            [miscUtils.assertReturn(miscUtils.getDeclarationFromReference(this.program, sourceFile, `Operator.Unref`)), `operator->`],
        ]);
    }

    getRuntimeUnit() {
        const runtimePath = path.resolve(__dirname, `../runtime/runtime.ts`);
        const sourceFile = this.program.getSourceFile(runtimePath);

        miscUtils.assertNotUndefined(sourceFile, `Expected the runtime to be loaded.`);

        return this.getUnit(sourceFile);
    }

    activate(node: ts.Node) {
        if (ts.isIdentifier(node))
            return this.activateIdentifier(node);

        if (ts.isParameter(node))
            return null;

        if (ts.isVariableDeclaration(node))
            return isTopLevelVariableDeclaration(node) ? this.getUnit(node.getSourceFile()).getGlobal(node) : null;

        if (ts.isFunctionDeclaration(node))
            return this.getUnit(node.getSourceFile()).getFunction(node);

        if (ts.isClassDeclaration(node))
            return this.getUnit(node.getSourceFile()).getClass(node);

        if ((ts.isConstructorDeclaration(node) || ts.isMethodDeclaration(node)) && ts.isClassDeclaration(node.parent) && node.body)
            return this.getUnit(node.getSourceFile()).getClass(node.parent).getMethod(node);

        if (ts.isPropertyDeclaration(node) && ts.isClassDeclaration(node.parent) && !node.name.getText().startsWith(`__cpp_`))
            return this.getUnit(node.getSourceFile()).getClass(node.parent).getProperty(node);

        return null;
    }

    private activateIdentifier(node: ts.Identifier): null {
        const sym = this.program.getTypeChecker()
            .getSymbolAtLocation(node);

        miscUtils.assertNodeNotUndefined(node, sym, `Expected this node to have a resolved symbol.`);
        miscUtils.assertNodeNotUndefined(node, sym.declarations, `Expected this node to have a linked declaration.`);

        for (const declaration of sym.declarations) {
            let entry = this.activate(declaration);
            if (entry) {
                return entry as any;
            }
        }

        return null;
    }

    getUnit(sourceFile: ts.SourceFile) {
        return miscUtils.getOrCreate(this.units, sourceFile, () => new UnitContext(this, sourceFile));
    }
}
