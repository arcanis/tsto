import * as ts from 'typescript';
import { Context, UnitContext } from '../Context';
import * as miscUtils from '../miscUtils';
import { Base } from './Base';

export interface FunctionOpts {
    includeNamespace?: boolean,
    classTypeParameters?: string[],
}

export class Function extends Base {
    isMain = false;

    signature: ts.Signature;

    constructor(public context: Context, public unit: UnitContext, public node: ts.ConstructorDeclaration | ts.MethodDeclaration | ts.FunctionDeclaration) {
        super();

        const signature = this.context.program.getTypeChecker()
            .getSignatureFromDeclaration(this.node);

        miscUtils.assertNodeNotUndefined(this.node, signature, `Expected function signature to be defined.`);
        this.signature = signature;
    }

    generateDeclaration() {
        if (ts.isConstructorDeclaration(this.node))
            return `${this.generateName()}(\n${this.generateArgs()});\n`;

        const name = this.generateName();
        if (name.startsWith(`operator `)) {
            return `${this.generateName()}(\n${this.generateArgs()});\n`;
        } else {
            return `auto ${this.generateName()}(\n${this.generateArgs()}) -> ${this.generateReturnType()};\n`;
        }
    }

    generateDefinition() {
        let result = ``;

        miscUtils.assertNodeNotUndefined(this.node, this.node.body, `Expected function body to be defined.`)

        result += `${this.generateDefinitionSignature()} {\n`;
        result += miscUtils.indent(this.unit.compiler.compileStatements(this.node.body.statements));
        result += `}\n`;

        if (this.isMain) {
            result += `\n`;
            result += `int main() {\n`;
            result += `  return userMain().toInt();`;
            result += `}\n`;
        }

        return result;
    }

    private generateDefinitionSignature() {
        if (ts.isConstructorDeclaration(this.node))
            return `${this.generateNamespace()}${this.generateName()}(\n${this.generateArgs()})`;
        
        if (ts.isMethodDeclaration(this.node)) {
            const name = this.generateName();
            if (name.startsWith(`operator `)) {
                return `${this.generateNamespace()}${this.generateName()}(\n${this.generateArgs()})`;
            } else {
                return `auto ${this.generateNamespace()}${this.generateName()}(\n${this.generateArgs()}) -> ${this.generateReturnType()}`;
            }
        }

        return `auto ${this.generateName()}(\n${this.generateArgs()}) -> ${this.generateReturnType()}`;
    }

    private generateReturnType() {
        return this.unit.compiler.compileType(this.signature.getReturnType());
    }

    private generateArgs() {
        return miscUtils.indent(this.node.parameters.map((param, idx) => {
            const type = this.context.program.getTypeChecker();
            const compiledType = this.unit.compiler.compileType(type.getTypeAtLocation(param));

            const sep = idx === this.node.parameters.length - 1 ? `` : `,`;
            return `${compiledType} ${param.name.getText()}${sep}\n`;
        }).join(``));
    }

    private generateNamespace() {
        if (ts.isFunctionDeclaration(this.node))
            return ``;

        miscUtils.assertNode(this.node.parent, ts.isClassDeclaration);
        miscUtils.assertNodeNotUndefined(this.node, this.node.parent.name, `Expected the parent class to have a name.`);

        return `${this.node.parent.name.getText()}::`;
    }

    private generateName() {
        if (ts.isConstructorDeclaration(this.node)) {
            miscUtils.assertNodeNotUndefined(this.node, this.node.parent.name, `Expected the parent class to have a name.`);

            return this.node.parent.name.getText();
        }

        miscUtils.assertNodeNotUndefined(this.node, this.node.name);

        if (ts.isComputedPropertyName(this.node.name)) {
            const type = this.context.program.getTypeChecker()
                .getTypeAtLocation(this.node.name.expression);

            const sym = type.getSymbol();
            miscUtils.assertNodeNotUndefined(this.node.name, sym, `Expected symbol to be defined.`);

            for (const decl of sym.declarations ?? []) {
                const op = this.context.operators.get(decl);
                if (typeof op !== `undefined`) {
                    return op;
                }
            }
        }

        miscUtils.assertNode(this.node.name, ts.isIdentifier);

        if (this.isMain)
            return `userMain`;

        return this.node.name.getText();
    }
}
