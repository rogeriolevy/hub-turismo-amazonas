import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(repositoryRoot, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);

if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
}

const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, repositoryRoot);
const moduleOptions = parsedConfig.options;
const sourceFiles = parsedConfig.fileNames.filter((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file));
const forbiddenRoots = ["server", "db"].map((directory) => path.join(repositoryRoot, directory));

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function isTypeOnlyImport(statement) {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause) return false;
    if (clause.isTypeOnly) return true;
    return (
      !clause.name &&
      clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.length > 0 &&
      clause.namedBindings.elements.every((element) => element.isTypeOnly)
    );
  }

  return (
    ts.isExportDeclaration(statement) &&
    (statement.isTypeOnly ||
      (statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)))
  );
}

function isClientEntry(sourceFile) {
  const firstStatement = sourceFile.statements[0];
  return (
    firstStatement &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === "use client"
  );
}

function runtimeModuleSpecifiers(sourceFile) {
  const specifiers = [];

  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      !isTypeOnlyImport(statement)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      specifiers.push(statement.moduleReference.expression.text);
    }
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function resolveLocalModule(specifier, containingFile) {
  const resolved = ts.resolveModuleName(
    specifier,
    containingFile,
    moduleOptions,
    ts.sys,
  ).resolvedModule;
  if (!resolved) return undefined;

  const file = path.resolve(resolved.resolvedFileName);
  if (!isWithin(repositoryRoot, file) || file.split(path.sep).includes("node_modules"))
    return undefined;
  return file;
}

function relative(file) {
  return path.relative(repositoryRoot, file).split(path.sep).join("/");
}

const clientEntries = sourceFiles.filter((file) => {
  const sourceFile = ts.createSourceFile(
    file,
    ts.sys.readFile(file) ?? "",
    ts.ScriptTarget.Latest,
    true,
  );
  return isClientEntry(sourceFile);
});

const violations = [];

for (const entry of clientEntries) {
  const pending = [[path.resolve(entry)]];
  const visited = new Set();

  while (pending.length > 0) {
    const chain = pending.shift();
    const current = chain.at(-1);
    if (visited.has(current)) continue;
    visited.add(current);

    if (forbiddenRoots.some((root) => isWithin(root, current))) {
      violations.push(chain.map(relative));
      break;
    }

    const source = ts.createSourceFile(
      current,
      ts.sys.readFile(current) ?? "",
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of runtimeModuleSpecifiers(source)) {
      const dependency = resolveLocalModule(specifier, current);
      if (dependency && !visited.has(dependency)) pending.push([...chain, dependency]);
    }
  }
}

if (violations.length > 0) {
  console.error("Client module graphs must not include server or database code:");
  for (const chain of violations) console.error(`  ${chain.join(" -> ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Architecture boundaries verified: ${clientEntries.length} client entry points do not import runtime code from server/ or db/.`,
  );
}
