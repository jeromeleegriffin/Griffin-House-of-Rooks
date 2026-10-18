/* Static checks for the current runtime. Historical checkpoints are not inputs. */
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const scope = require('eslint-scope');
const root = path.resolve(__dirname, '..');
const errors = [];
const frozen = new Set(['bots.js', 'rules.js', 'qrcode845.js']);
const scripts = fs.readdirSync(root).filter((name) => name.endsWith('.js'));
let localBindings = 0;

for (const file of scripts) {
  try {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 'latest', locations: true, ranges: true });
    if (frozen.has(file)) continue;
    const manager = scope.analyze(ast, { ecmaVersion: 2024, optimistic: true });
    for (const current of manager.scopes) {
      if (current.type === 'global') continue; // Classic scripts intentionally share public globals.
      for (const variable of current.variables) {
        if (variable.name === 'arguments') continue;
        const definitions = variable.defs.filter((def) => def.type === 'Variable');
        localBindings += definitions.length;
        if (!definitions.length || variable.references.some((ref) => ref.isRead())) continue;
        errors.push(`${file}:${definitions[0].node.loc.start.line}: unused local ${variable.name}`);
      }
    }
    walk.simple(ast, {
      BlockStatement(node) {
        let ended = false;
        for (const statement of node.body) {
          if (ended && !['FunctionDeclaration', 'EmptyStatement'].includes(statement.type)) {
            errors.push(`${file}:${statement.loc.start.line}: unreachable statement`);
          }
          if (
            ['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement'].includes(
              statement.type
            )
          ) {
            ended = true;
          }
        }
      },
    });
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) {
  const file = match[1].split(/[?#]/)[0];
  if (/^(?:https?:|data:|\/\/)/.test(file)) continue;
  if (!fs.existsSync(path.join(root, file))) errors.push(`index.html: missing ${file}`);
}

const worker = fs.readFileSync(path.join(root, 'sw060.js'), 'utf8');
const workerAst = acorn.parse(worker, { ecmaVersion: 'latest' });
const shell = workerAst.body
  .flatMap((node) => (node.type === 'VariableDeclaration' ? node.declarations : []))
  .find((node) => node.id.name === 'SHELL')
  .init.elements.map((node) => node.value);
if (new Set(shell).size !== shell.length) errors.push('sw060.js: duplicate precache paths');
for (const entry of shell) {
  const file = entry.replace(/^\.\//, '').split('?')[0] || 'index.html';
  if (!fs.existsSync(path.join(root, file))) errors.push(`sw060.js: missing ${file}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `PASS: ${scripts.length} scripts, ${localBindings} local bindings, entry dependencies, ${shell.length} unique precache paths.`
  );
}
