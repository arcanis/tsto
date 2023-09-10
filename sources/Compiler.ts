import * as ts from "typescript";
import { Context } from "./Context";
import * as miscUtils from "./miscUtils";

export class Compiler {
    constructor(public context: Context) {
    }

    compile(stmt: ts.Statement) {
        if (ts.isVariableStatement(stmt))
            return this.compileVariableStatement(stmt);

        if (ts.isReturnStatement(stmt))
            return this.compileReturnStatement(stmt);

        miscUtils.throwNodeError(stmt, `Unsupported statement type ${ts.SyntaxKind[stmt.kind]}.`);
    }

    compileVariableStatement(node: ts.VariableStatement) {
        let result = ``;

        for (const decl of node.declarationList.declarations) {
            const type = this.context.program.getTypeChecker()
                .getTypeAtLocation(decl);

            const name = decl.name.getText();
            const compiledType = this.context.compileType(type);

            result += decl.initializer
                ? `${compiledType} ${name} = ${this.compileExpression(decl.initializer)};\n`
                : `${compiledType} ${name};\n`;
        }

        return result;
    }

    compileReturnStatement(node: ts.ReturnStatement) {
        if (node.expression) {
            return `return ${this.compileExpression(node.expression)};\n`;
        } else {
            return `return;\n`;
        }
    }

    compileExpression(node: ts.Expression): string {
        if (ts.isBigIntLiteral(node))
            return `${node.getText().slice(0, -1)}ULL`;

        if (ts.isNumericLiteral(node))
            return `${Number(node.getText()).toExponential()}`;

        if (ts.isStringLiteral(node))
            return `std::string("${node.getText().slice(1, -1)}")`;

        if (ts.isNoSubstitutionTemplateLiteral(node))
            return `std::string("${node.getText().slice(1, -1)}")`;

        if (ts.isPropertyAccessExpression(node))
            return this.compilePropertyAccessExpression(node);

        if (ts.isBinaryExpression(node))
            return this.compileBinaryExpression(node);

        if (ts.isCallExpression(node))
            return this.compileCallExpression(node);

        if (ts.isConditionalExpression(node))
            return this.compileConditionalExpression(node);

        if (ts.isNewExpression(node))
            return this.compileNewExpression(node);

        if (ts.isIdentifier(node))
            return this.compileIdentifier(node);

        miscUtils.throwNodeError(node, `Unsupported expression type ${ts.SyntaxKind[node.kind]}.`);
    }

    private compileBinaryExpression(node: ts.BinaryExpression) {
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken)
            return `${this.compileExpression(node.left)} + ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.MinusToken)
            return `${this.compileExpression(node.left)} - ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken)
            return `${this.compileExpression(node.left)} * ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.SlashToken)
            return `${this.compileExpression(node.left)} / ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)
            return `${this.compileExpression(node.left)} == ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
            return `${this.compileExpression(node.left)} != ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.LessThanToken)
            return `${this.compileExpression(node.left)} < ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken)
            return `${this.compileExpression(node.left)} <= ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.GreaterThanToken)
            return `${this.compileExpression(node.left)} > ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.GreaterThanEqualsToken)
            return `${this.compileExpression(node.left)} >= ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
            return `${this.compileExpression(node.left)} && ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
            return `${this.compileExpression(node.left)} || ${this.compileExpression(node.right)}`;

        miscUtils.throwNodeError(node, `Unsupported binary expression operator ${ts.SyntaxKind[node.operatorToken.kind]}.`);
    }

    private compileCallExpression(node: ts.CallExpression) {
        this.context.activate(node.expression);

        const args = node.arguments
            .map(arg => this.compileExpression(arg))
            .join(`, `);

        return `${this.compileExpression(node.expression)}(${args})`;
    }

    private compileNewExpression(node: ts.NewExpression) {
        miscUtils.assertNode(node.expression, ts.isIdentifier);

        this.context.activate(node.expression);

        const args = node.arguments ?? []
            .map(arg => this.compileExpression(arg))
            .join(`, `);

        return `std::make_shared<${node.expression.text}>(${args})`;
    }

    private compileConditionalExpression(node: ts.ConditionalExpression) {
        const whenTrue = miscUtils.indent(miscUtils.indent(this.compileExpression(node.whenTrue))).trim();
        const whenFalse = miscUtils.indent(miscUtils.indent(this.compileExpression(node.whenFalse))).trim();

        return `${this.compileExpression(node.condition)}\n  ? ${whenTrue}\n  : ${whenFalse}\n`;
    }

    private compilePropertyAccessExpression(node: ts.PropertyAccessExpression) {
        return `${this.compileExpression(node.expression)}.${node.name.getText()}`;
    }

    private compileIdentifier(node: ts.Identifier) {
        this.context.activate(node);

        return node.getText();
    }
}
