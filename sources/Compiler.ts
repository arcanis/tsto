import * as ts from "typescript";
import { Context, UnitContext } from "./Context";
import * as miscUtils from "./miscUtils";
import path from "path";
import { Class } from "./tsto/Class";

export class Compiler {
    constructor(public context: Context, public unit: UnitContext) {
    }

    getStringType() {
        this.unit.top.add(`#include <string>`);
        return `std::string`;
    }

    compileType(type: ts.Type): string {
        const typeChecker = this.context.program.getTypeChecker();

        if (miscUtils.isTypeParameter(type))
            return type.symbol.name;

        if (type === typeChecker.getBigIntType()) {
            this.unit.addRuntimeDependency(`Int`, Class);
            return `Int`;
        }

        if (type === typeChecker.getNumberType())
            return `double`;
        if (type === typeChecker.getStringType())
            return this.getStringType();
        if (type === typeChecker.getBooleanType())
            return `bool`;
        if (type === typeChecker.getVoidType())
            return `void`;

        if (miscUtils.isArrayType(typeChecker, type))
            return `Array<${this.compileType(type.typeArguments![0])}>`;

        if (type.isUnion()) {
            if (type.types.length === 2) {
                const [a, b] = type.types;
                if (a === typeChecker.getUndefinedType() || b === typeChecker.getUndefinedType()) {
                    const other = a === typeChecker.getUndefinedType() ? b : a;
                    return `std::optional<${this.compileType(other)}>`;
                }
            }
        }

        if (type.isClass()) {
            let passBy = `reference`;

            const property = type.getProperty(`__cpp_model`);
            if (property) {
                const modelType = typeChecker.getTypeOfSymbol(property);
                miscUtils.assertCheck(modelType.isStringLiteral(), `Expected __cpp_model to be a string literal.`);

                passBy = modelType.value;
            }

            const symbol = type.getSymbol();
            miscUtils.assertNotUndefined(symbol);

            const decl = symbol.declarations!.find((decl): decl is ts.ClassDeclaration => ts.isClassDeclaration(decl));
            miscUtils.assertNotUndefined(decl);

            const klass = this.context.getUnit(decl.getSourceFile())
                .getClass(decl);

            this.unit.top.add(`#include <memory>`);
            this.unit.addDependency(klass.unit);

            if (passBy === `reference`) {
                return `std::shared_ptr<${symbol.name}>`;
            } else {
                return symbol.name;
            }
        }

        if (type.isClassOrInterface()) {
            const symbol = type.getSymbol();
            miscUtils.assertNotUndefined(symbol);

            const decl = symbol.declarations!.find((decl): decl is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(decl));
            miscUtils.assertNotUndefined(decl);

            const struct = this.context.getUnit(decl.getSourceFile())
                .getStruct(decl);

            this.unit.addDependency(struct.unit);

            return `${symbol.name}`;
        }

        if (type.aliasSymbol?.escapedName === `Cpp`) {
            const typeParameter = type.aliasTypeArguments?.[0];

            miscUtils.assertNotUndefined(typeParameter);
            miscUtils.assertCheck(typeParameter.isStringLiteral(), `Expected Cpp type parameter to be a string literal.`);

            return typeParameter.value;
        }

        throw new Error(`Unsupported type ${typeChecker.typeToString(type)}.`);
    }

    compileStatements(statements: ts.NodeArray<ts.Statement>) {
        let result = ``;

        for (const statement of statements)
            result += this.compileStatement(statement);

        return result;
    }

    compileStatement(stmt: ts.Statement) {
        if (ts.isVariableStatement(stmt))
            return this.compileVariableStatement(stmt);

        if (ts.isReturnStatement(stmt))
            return this.compileReturnStatement(stmt);

        if (ts.isExpressionStatement(stmt)) {
            const result = this.compileExpression(stmt.expression);
            return result ? `${result};\n` : ``;
        }

        miscUtils.throwNodeError(stmt, `Unsupported statement type ${ts.SyntaxKind[stmt.kind]}.`);
    }

    compileVariableStatement(node: ts.VariableStatement) {
        let result = ``;

        for (const decl of node.declarationList.declarations) {
            const type = this.context.program.getTypeChecker()
                .getTypeAtLocation(decl.name);

            const name = decl.name.getText();
            const compiledType = this.compileType(type);

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
            return this.compileBigIntLiteral(node);

        if (ts.isNumericLiteral(node))
            return `${Number(node.getText()).toExponential()}`;

        if (ts.isStringLiteralLike(node))
            return `${this.getStringType()}("${node.text}")`;

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

        if (ts.isTaggedTemplateExpression(node))
            return this.compileTaggedTemplateExpression(node);

        if (ts.isObjectLiteralExpression(node))
            return this.compileObjectLiteralExpression(node);

        if (ts.isArrayLiteralExpression(node))
            return this.compileArrayLiteralExpression(node);

        if (node.kind === ts.SyntaxKind.ThisKeyword)
            return `(*this)`;

        miscUtils.throwNodeError(node, `Unsupported expression type ${ts.SyntaxKind[node.kind]}.`);
    }

    private compileBigIntLiteral(node: ts.BigIntLiteral) {
        this.unit.addRuntimeDependency(`Int`, Class)
            .activateAll();

        return `Int(${node.getText().slice(0, -1)}LL)`;
    }

    private compileBinaryExpression(node: ts.BinaryExpression) {
        if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
            return `${this.compileExpression(node.left)} = ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken)
            return `${this.compileExpression(node.left)} + ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.MinusToken)
            return `${this.compileExpression(node.left)} - ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken)
            return `${this.compileExpression(node.left)} * ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.SlashToken)
            return `${this.compileExpression(node.left)} / ${this.compileExpression(node.right)}`;

        if (node.operatorToken.kind === ts.SyntaxKind.PercentToken)
            return `${this.compileExpression(node.left)} % ${this.compileExpression(node.right)}`;

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
        if (ts.isIdentifier(node.expression) && node.expression.getText() === `__cpp_top`)
            return this.compileCppTopCallExpression(node);

        this.unit.activateWithDependency(node.expression);

        const args = node.arguments
            .map(arg => this.compileExpression(arg))
            .join(`, `);

        return `${this.compileExpression(node.expression)}(${args})`;
    }

    private compileCppTopCallExpression(node: ts.CallExpression) {
        miscUtils.assertNode(node.parent, ts.isExpressionStatement);
        miscUtils.assertNodeCheck(node, node.arguments.length === 1, `Expected C++ top call to have exactly one argument.`);

        if (!ts.isStringLiteral(node.arguments[0]) && !ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
            miscUtils.assertNode(node.arguments[0], ts.isStringLiteral);

        this.unit.top.add(node.arguments[0].text);

        return ``;
    }

    private compileNewExpression(node: ts.NewExpression) {
        miscUtils.assertNode(node.expression, ts.isIdentifier);

        this.unit.activateWithDependency(node.expression);

        const args = node.arguments ?? []
            .map(arg => this.compileExpression(arg))
            .join(`, `);

        return `std::make_shared<${node.expression.text}>(${args})`;
    }

    private compileTaggedTemplateExpression(node: ts.TaggedTemplateExpression) {
        if (ts.isIdentifier(node.tag) && node.tag.getText() === `__cpp`)
            return this.compileCppTaggedTemplateExpression(node);

        miscUtils.throwNodeError(node, `Unsupported tagged template tag ${ts.SyntaxKind[node.tag.kind]}.`);
    }

    private compileCppTaggedTemplateExpression(node: ts.TaggedTemplateExpression) {
        const {quasis, expressions} = miscUtils.extractParts(node);

        let result = quasis[0];
        for (let t = 0; t < expressions.length; t++) {
            result += this.compileExpression(expressions[t]);
            result += quasis[t + 1];
        }

        return result;
    }

    private compileConditionalExpression(node: ts.ConditionalExpression) {
        const whenTrue = miscUtils.indent(miscUtils.indent(this.compileExpression(node.whenTrue))).trim();
        const whenFalse = miscUtils.indent(miscUtils.indent(this.compileExpression(node.whenFalse))).trim();

        return `${this.compileExpression(node.condition)}\n  ? ${whenTrue}\n  : ${whenFalse}\n`;
    }

    private compileObjectLiteralExpression(node: ts.ObjectLiteralExpression) {
        const type = this.context.program.getTypeChecker()
            .getContextualType(node);

        miscUtils.assertNodeNotUndefined(node, type, `Expected object literal to have a contextual type.`);

        const compiledType = this.compileType(type);

        let result = `${compiledType} {\n`;

        for (const prop of node.properties) {
            miscUtils.assertNode(prop, ts.isPropertyAssignment);
            result += `  .${prop.name.getText()} = ${this.compileExpression(prop.initializer)},\n`;
        }

        result += `}`;

        return result;
    }

    private compilePropertyAccessExpression(node: ts.PropertyAccessExpression) {
        if (node.expression.kind === ts.SyntaxKind.ThisKeyword)
            return `(*this)->${node.name.getText()}`;

        const typeChecker = this.context.program.getTypeChecker();
        const type = typeChecker
            .getTypeAtLocation(node.expression);

        const symbol = type.getSymbol();
        miscUtils.assertNodeNotUndefined(node, symbol, `Expected property access expression to have a symbol.`);

        if (type.isClass())
            return `${this.compileExpression(node.expression)}->${node.name.getText()}`;

        if (type.isClassOrInterface())
            return `${this.compileExpression(node.expression)}.${node.name.getText()}`;

        if (typeChecker.isArrayType(type))
            return `${this.compileExpression(node.expression)}->${node.name.getText()}`;

        miscUtils.throwNodeError(node, `Unsupported property access expression type ${typeChecker.typeToString(type)}.`);
    }

    private compileArrayLiteralExpression(node: ts.ArrayLiteralExpression) {
        const typeChecker = this.context.program.getTypeChecker();
        const type = typeChecker.getContextualType(node) ?? typeChecker.getTypeAtLocation(node);

        miscUtils.assertNodeNotUndefined(node, type, `Expected array literal to have a type.`);

        if (!miscUtils.isArrayType(typeChecker, type))
            miscUtils.throwNodeError(node, `Expected array literal to have an array type.`);

        miscUtils.assertNodeNotUndefined(node, type.typeArguments?.[0], `Expected array literal to have type arguments.`);

        this.unit.addRuntimeDependency(`Array.prototype.push`);

        return `Array<${this.compileType(type.typeArguments[0])}> {}`;
    }

    private compileIdentifier(node: ts.Identifier) {
        this.unit.activateWithDependency(node);

        return node.getText();
    }
}
