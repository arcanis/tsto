import * as ts from 'typescript';
import { Context } from '../Context';
import * as miscUtils from '../miscUtils';
import { Base } from './Base';

export class Function extends Base {
    isMain = false;

    constructor(public context: Context, public node: ts.FunctionDeclaration) {
        super();
    }

    signature() {
        const signature = this.context.program.getTypeChecker()
            .getSignatureFromDeclaration(this.node);

        miscUtils.assertNodeNotUndefined(this.node, signature, `Expected function signature to be defined.`);

        const compiledReturnType = !this.isMain
            ? this.context.compileType(signature.getReturnType())
            : `int`;

        miscUtils.assertNodeNotUndefined(this.node, this.node.name, `Expected function name to be defined.`);
        miscUtils.assertNodeNotUndefined(this.node, this.node.body, `Expected function body to be defined.`)

        const args = miscUtils.indent(this.node.parameters.map((param, idx) => {
            const type = this.context.program.getTypeChecker();
            const compiledType = this.context.compileType(type.getTypeAtLocation(param));

            const sep = idx === this.node.parameters.length - 1 ? `` : `,`;
            return `${compiledType} ${param.name.getText()}${sep}\n`;
        }).join(``));

        return `auto ${this.node.name.getText()}(\n${args}) -> ${compiledReturnType}`;
    }

    generate() {
        let result = ``;

        miscUtils.assertNodeNotUndefined(this.node, this.node.body, `Expected function body to be defined.`)

        result += `${this.build(this.signature)} {\n`;
        result += miscUtils.indent(this.context.compile(this.node.body.statements));
        result += `}\n`;

        return result;
    }
}
