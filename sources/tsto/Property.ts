import ts from "typescript";
import { Context, UnitContext } from "../Context";
import * as miscUtils from "../miscUtils";
import { Base } from "./Base";

export class Property extends Base {
    type: ts.Type;

    constructor(public context: Context, public unit: UnitContext, public node: ts.PropertyDeclaration) {
        super();

        const type = this.context.program.getTypeChecker()
            .getTypeAtLocation(node.name);

        miscUtils.assertNodeNotUndefined(this.node, type, `Expected property type to be defined.`);
        this.type = type;
    }

    generateDeclaration() {
        return `${this.unit.compiler.compileType(this.type)}\n  ${this.node.name.getText()};\n`;
    }
}
