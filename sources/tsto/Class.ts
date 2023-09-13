import ts from "typescript";
import { Context, UnitContext } from "../Context";
import * as miscUtils from "../miscUtils";
import { Base } from "./Base";
import { Function } from "./Function";
import { Property } from "./Property";

export class Class extends Base {
    methods = new Map<ts.ConstructorDeclaration | ts.MethodDeclaration, Function>();
    properties = new Map<ts.PropertyDeclaration, Property>();

    constructor(public context: Context, public unit: UnitContext, public node: ts.ClassDeclaration) {
        super();

        miscUtils.assertNodeNotUndefined(this.node, this.node.name, `Expected class name to be defined.`);
    }

    getMethod(methodNode: ts.ConstructorDeclaration | ts.MethodDeclaration) {
        return miscUtils.getOrCreate(this.methods, methodNode, () => new Function(this.context, this.unit, methodNode));
    }

    getProperty(propertyNode: ts.PropertyDeclaration) {
        return miscUtils.getOrCreate(this.properties, propertyNode, () => new Property(this.context, this.unit, propertyNode));
    }

    activateAll() {
        for (const member of this.node.members) {
            this.context.activate(member);
        }
    }

    generateDeclaration() {
        let result = ``;

        const typeChecker = this.context.program.getTypeChecker();
        const type = typeChecker
            .getTypeAtLocation(this.node);

        const typeArguments: string[] = [];

        if (miscUtils.isTypeReference(type))
            for (const typeArgument of typeChecker.getTypeArguments(type))
                typeArguments.push(`typename ${typeArgument.symbol.name}`);

        if (typeArguments.length > 0)
            result += `template <${typeArguments.join(`, `)}>\n`;

        result += `struct ${this.node.name!.getText()} {\n`;

        for (const property of this.properties.values())
            result += miscUtils.indent(miscUtils.maybeLine(property.generateDeclaration()));

        for (const method of this.methods.values())
            result += miscUtils.indent(miscUtils.maybeLine(method.generateDeclaration()));

        result += `};\n`;

        return result;
    }

    generateDefinition() {
        miscUtils.assertNodeNotUndefined(this.node, this.node.name, `Expected class name to be defined.`);

        let result = ``;

        for (const method of this.methods.values())
            result += miscUtils.maybeLine(method.generateDefinition());

        return result;
    }
}
