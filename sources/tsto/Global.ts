import * as ts from 'typescript';
import { Context, UnitContext } from '../Context';
import { Base } from './Base';

export class Global extends Base {
    constructor(public context: Context, public unit: UnitContext, public node: ts.VariableDeclaration) {
        super();
    }

    declaration() {
        const type = this.context.program.getTypeChecker()
            .getTypeAtLocation(this.node);

        const compiledType = this.unit.compiler.compileType(type);
        return `extern ${compiledType}\n  ${this.node.name.getText()};\n`;
    }

    generate() {
        if (!this.node.initializer)
            return null;

        const type = this.context.program.getTypeChecker()
            .getTypeAtLocation(this.node);

        const compiledType = this.unit.compiler.compileType(type);
        const compiledInitializer = this.unit.compiler.compileExpression(this.node.initializer);

        return `${compiledType}\n  ${this.node.name.getText()} = ${compiledInitializer};\n`;
    }
}
