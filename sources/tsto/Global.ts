import * as ts from 'typescript';
import { Context } from '../Context';
import { Base } from './Base';

export class Global extends Base {
    constructor(public context: Context, public node: ts.VariableDeclaration) {
        super();
    }

    declaration() {
        const type = this.context.program.getTypeChecker()
            .getTypeAtLocation(this.node);

        const compiledType = this.context.compileType(type);
        return `${compiledType}\n  ${this.node.name.getText()};\n`;
    }

    generate() {
        if (!this.node.initializer)
            return null;

        const type = this.context.program.getTypeChecker()
            .getTypeAtLocation(this.node);

        const compiledType = this.context.compileType(type);
        const compiledInitializer = this.context.compiler.compileExpression(this.node.initializer);

        return `${compiledType}\n  ${this.node.name.getText()} = ${compiledInitializer};\n`;
    }
}
