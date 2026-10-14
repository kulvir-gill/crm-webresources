import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const rootNs = process.env.JS_NAMESPACE || "PPHL";
const outRoot = path.join("dist");

const pascal = /** @param {string} s */ (s) =>
  s.replace(
    /(^|[-_.\s])(\w)/g,
    /**
     * @param {string} _
     * @param {string} __
     * @param {string} c
     */
    (_, __, c) => c.toUpperCase(),
  );

const sources = await fg(["src/entities/*/forms/*.ts"]);

/** @param {string} file */
function describe(file) {
  const rel = path.relative("src/entities", file).split(path.sep);
  const entity = pascal(rel[0]);
  const ns = [rootNs, entity];
  rel[rel.length - 1] = `${path.basename(rel[rel.length - 1], ".ts")}.js`;
  const outfile = path.join(outRoot, "js", ...rel);
  return { ns, outfile };
}

/**
 * @param {string} source
 * @param {string[]} ns
 */
function toNamespaceScript(source, ns) {
  const sourceFile = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const classNode = sourceFile.statements.find(
    (statement) =>
      ts.isClassDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
  );
  const methods =
    classNode && ts.isClassDeclaration(classNode)
      ? classNode.members
          .filter((member) => ts.isMethodDeclaration(member) && member.body)
          .map((member) => {
            if (!ts.isMethodDeclaration(member) || !member.body) return null;

            const rawName = member.name.getText(sourceFile);
            const name = rawName.replace(/^#/, "");
            const paramTypes = member.parameters
              .map((parameter) => {
                if (!parameter.type) return null;
                return {
                  name: parameter.name.getText(sourceFile),
                  type: parameter.type.getText(sourceFile),
                };
              })
              .filter((paramType) => paramType !== null);
            const params = member.parameters.map((parameter) => parameter.name.getText(sourceFile)).join(", ");
            const isPrivate =
              member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword) ||
              rawName.startsWith("#");
            const body = member.body
              .getText(sourceFile)
              .slice(1, -1)
              .replace(/super\.[A-Za-z0-9_$]+\([^)]*\);?\s*/g, "");
            const transpiled = ts.transpileModule(`function method(${params}) {${body}}`, {
              compilerOptions: { target: ts.ScriptTarget.ES5 },
            }).outputText;
            const transpiledFile = ts.createSourceFile("method.js", transpiled, ts.ScriptTarget.Latest, true);
            const functionNode = transpiledFile.statements.find(ts.isFunctionDeclaration);
            const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
            const jsBody =
              functionNode?.body?.statements
                .map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, transpiledFile))
                .join("\n") || "";

            return { name, params, paramTypes, body: jsBody, isPrivate };
          })
          .filter((method) => method !== null)
      : [];
  const privateMethods = methods.filter((method) => method.isPrivate);
  const publicMethods = methods.filter((method) => !method.isPrivate);

  if (publicMethods.length === 0) {
    return `var ${ns[0]} = window.${ns[0]} || {};\n\n${ns[0]}.${ns[1]} = (function () {\n    "use strict";\n\n    return {};\n})();\n`;
  }

  const methodEntries = publicMethods
    .map(({ name, params, paramTypes, body }) => {
      const privateBody = privateMethods.reduce((text, helper) => {
        const helperCall = new RegExp(`this\\.#?${helper.name}\\s*\\(`, "g");
        return text.replace(helperCall, `__private_${helper.name}(`);
      }, body);
      const parameterDocs = paramTypes.map(({ name, type }) => `         * @param {${type}} ${name}`).join("\n");
      const jsDoc = parameterDocs ? `        /**\n${parameterDocs}\n         */\n` : "";

      const indentedBody = privateBody
        .split("\n")
        .map((line) => (line ? `            ${line}` : ""))
        .join("\n");

      return `${jsDoc}        ${name}: function (${params || ""}) {\n${indentedBody}\n        }`;
    })
    .join(",\n");

  const privateEntries = privateMethods
    .map(({ name, params, paramTypes, body }) => {
      const normalizedBody = body
        .split("\n")
        .map((line) => (line ? `        ${line}` : ""))
        .join("\n");
      const parameterDocs = paramTypes.map(({ name, type }) => `     * @param {${type}} ${name}`).join("\n");
      const jsDoc = parameterDocs ? `    /**\n${parameterDocs}\n     */\n` : "";

      return `${jsDoc}    function __private_${name}(${params || ""}) {\n${normalizedBody}\n    }`;
    })
    .join("\n\n");

  const helperBlock = privateEntries ? `\n${privateEntries}\n\n` : "";

  return `var ${ns[0]} = window.${ns[0]} || {};\n\n${ns[0]}.${ns[1]} = (function () {\n    "use strict";\n\n    // Private variables\n    var entityName = "${ns[1].toLowerCase()}";\n${helperBlock}    // Public functions exposed to Dynamics CRM\n    return {\n${methodEntries}\n    };\n})();\n`;
}

await fs.rm("dist", { recursive: true, force: true });

for (const file of sources) {
  const { ns, outfile } = describe(file);
  const source = await fs.readFile(file, "utf8");
  const script = toNamespaceScript(source, ns);

  await fs.mkdir(path.dirname(outfile), { recursive: true });
  await fs.writeFile(outfile, script, "utf8");
}

const htmlFiles = await fg("src/html/**/*.{html,htm,css,png,jpg,jpeg,gif,svg,ico,xml,resx}");
for (const file of htmlFiles) {
  const dest = path.join(outRoot, path.relative("src", file));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(file, dest);
}

for (const file of sources) {
  const { outfile } = describe(file);
  console.log(`${path.relative("dist", outfile).split(path.sep).join("/")}`);
}

console.log(`generated ${sources.length} script(s), copied ${htmlFiles.length} static file(s)`);
