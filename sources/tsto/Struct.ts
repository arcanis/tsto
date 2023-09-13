import ts from "typescript";
import { Context, UnitContext } from "../Context";
import * as miscUtils from "../miscUtils";
import { Base } from "./Base";

export class Struct extends Base {
    constructor(public context: Context, public unit: UnitContext, public node: ts.InterfaceDeclaration) {
        super();

        miscUtils.assertNodeNotUndefined(this.node, this.node.name, `Expected the interface name to be defined.`);
    }

    signature() {
        let result = ``;
        
        result += `struct ${this.node.name!.getText()} {\n`;

        for (const member of this.node.members) {
            miscUtils.assertNode(member, ts.isPropertySignature);

            result += `  ${this.unit.compiler.compileType(this.context.program.getTypeChecker().getTypeAtLocation(member))} ${this.getMemberName(member)};\n`;
        }

        result += `};\n`;

        return result;
    }

    private getMemberName(member: ts.PropertySignature) {
        miscUtils.assertNodeNotUndefined(member, member.name);

        return `${member.name.getText()}`;
    }
}
