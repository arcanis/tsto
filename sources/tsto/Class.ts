import ts from "typescript";
import { Context } from "../Context";
import * as miscUtils from "../miscUtils";

export class ClassMethod {
    constructor(public context: Context, public node: ts.MethodDeclaration) {
    }
}

export class Class {
    methods = new Map<ts.MethodDeclaration, ClassMethod>();

    constructor(public context: Context, public node: ts.ClassDeclaration) {
    }

    getMethod(methodNode: ts.MethodDeclaration) {
        return miscUtils.getOrCreate(this.methods, methodNode, () => new ClassMethod(this.context, methodNode));
    }
}
