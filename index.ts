import {Command, Option, runExit} from 'clipanion';
import fs from 'fs';
import path, { parse } from 'path';
import * as ts from 'typescript';
import { Context } from './sources/Context';
import * as miscUtils from './sources/miscUtils';

const formatDiagnosticHost: ts.FormatDiagnosticsHost = {
    getNewLine: () => `\n`,
    getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
    getCanonicalFileName: fileName => fileName,
};

runExit(class extends Command {
    tsconfig = Option.String(`--tsconfig`, `tsconfig.tsto.json`);

    entry = Option.String();

    async execute() {
        await this.generate();
    }

    async generate() {
        const configPath = ts.findConfigFile(`./`, ts.sys.fileExists, this.tsconfig);
        if (!configPath)
            throw new Error(`Couldn't find a valid tsconfig file`);

        const configReadResult = ts.readConfigFile(configPath, ts.sys.readFile);
        if (configReadResult.error)
            throw new Error(ts.formatDiagnostic(configReadResult.error, formatDiagnosticHost));

        const parseResult = ts.parseJsonConfigFileContent(configReadResult.config, ts.sys, path.dirname(configPath));
        if (parseResult.errors.length > 0)
            throw new Error(ts.formatDiagnostic(parseResult.errors[0], formatDiagnosticHost));

        const resolved = path.resolve(this.entry);
        const runtime = path.resolve(__dirname, `./sources/runtime.ts`);

        const program = ts.createProgram([resolved, runtime], parseResult.options);
        
        const entryFile = program.getSourceFile(resolved);
        miscUtils.assertValue(entryFile);

        const functionDeclarations = entryFile.statements.filter(ts.isFunctionDeclaration);

        const mainFunction = functionDeclarations.find(stmt => stmt.name?.escapedText === `main`);
        if (!mainFunction)
            miscUtils.throwNodeError(entryFile, `No function declaration found for "main".`);

        const mainModifiers = ts.getCombinedModifierFlags(mainFunction);
        if (!(mainModifiers & ts.ModifierFlags.Export))
            miscUtils.throwNodeError(mainFunction, `The "main" function isn't exported.`);

        const tsconfigRoot = path.dirname(configPath);

        const rootDir = path.resolve(tsconfigRoot, parseResult.options.rootDir ?? `.`);
        const outDir = path.resolve(tsconfigRoot, parseResult.options.outDir ?? `dist`);
    
        const context = new Context(program, rootDir);
        const main = context.getUnit(entryFile)
            .getFunction(mainFunction);

        main.isMain = true;
        main.generate();

        const okFolders = new Set<string>();

        for (const unit of context.units.values()) {
            const relPath = unit.getRelativePath();
            if (relPath.startsWith(`..${path.sep}`))
                continue;

            const folder = path.resolve(outDir, path.dirname(relPath));
            if (!okFolders.has(folder)) {
                fs.mkdirSync(folder, {recursive: true});
                okFolders.add(folder);
            }

            const headerPath = path.resolve(outDir, relPath + `.h`);
            fs.writeFileSync(headerPath, unit.generateHeader());

            const sourcePath = path.resolve(outDir, relPath + `.cpp`);
            fs.writeFileSync(sourcePath, unit.generateSource());
        }
    }
});
