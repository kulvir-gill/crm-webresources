# CRM Web Resources

TypeScript source for Dataverse form scripts. The build emits plain JavaScript web resources under `dist/`; it does not deploy them.

## Setup

```bash
npm install
```

## Source layout

```text
src/
  entities/account/account.ts
  entities/account/forms/information.ts
  html/                         Static assets copied as-is
```

TypeScript is checked against the Xrm definitions from `@types/xrm`. Form classes can extend their entity class, and private methods are kept out of the public CRM namespace.

## Commands

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `npm run typecheck` | Type-check TypeScript source                  |
| `npm run lint`      | Lint source and build scripts                 |
| `npm run build`     | Generate CRM-compatible JavaScript in `dist/` |
| `npm run watch`     | Rebuild when source files change              |

`JS_NAMESPACE` configures the namespace root. The publisher output path is fixed at `dist/new_`. The build preserves the `window`-scoped namespace and emits the public form handlers as an object.
