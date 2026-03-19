# AGENTS.md

Guidance for contributors and coding agents working in `c:\dev\modapp\barejsx`.

## Project Purpose

`barejsx` is a standalone JSX-native library for a very small component model:

- A `Component` has `render(el)` and `unrender()`.
- Lowercase JSX tags such as `<div />` compile to structured JSX objects, not to DOM nodes and not to `Elem` instances.
- Capitalized JSX tags must expose a static `fromJSX(props)` function and must return a `Component`.

## Current Design Rules

### JSX Runtime

The runtime lives in:

- `src/jsx-runtime.ts`
- `src/jsx-dev-runtime.ts`
- `src/internal.ts`

Keep these rules stable unless the user explicitly asks to change them:

- Lowercase intrinsic tags return `JsxElementObject`.
- Capitalized component tags call `type.fromJSX(props)`.
- `fromJSX(props)` must return a valid `Component`.
- Fragment syntax is currently unsupported and should throw a clear error.
- `nodeId` is preserved as component metadata for embedded component children.
- `key`, `ref`, `__self`, and `__source` are JSX/runtime-only inputs and should not survive into normalized props.

### Elem

`Elem` lives in `src/Elem.ts`.

Important conventions:

- `Elem` stores a single structured `JsxElementObject` in `element`.
- `tagName` and `props` are derived convenience fields.
- `Elem.fromJSX(props)` defaults the tag name to `'div'`.
- The JSX-facing prop for choosing tag name is `as`, not `tagName`.
- `as` is a control prop and must not remain in the final structured element props.

### Types

Type definitions live in `src/types.ts`.

Keep the distinctions clear:

- `Component` is the render/unrender interface.
- `JsxElementObject` is the structured lowercase JSX result.
- `JsxChild` is the broad input union before normalization.
- `JsxNormalizedChild` is the normalized child union after runtime normalization.

Do not collapse structured JSX objects and component instances into one shape unless the user explicitly asks for that change.

## Build And Test

### Commands

Use these commands from the package root:

```sh
npm install
npm run build
npm run typecheck
npm test
```

`npm test` currently performs:

1. build with `tsdown`
2. declaration emit with `tsc`
3. typecheck
4. runtime tests with Node's built-in test runner

### Generated Files

- `dist/` is generated output.
- Do not manually edit files in `dist/`.
- Always change `src/` and rebuild.

## Editing Guidance

- Prefer keeping the runtime small and explicit over adding abstractions.
- Preserve current naming unless there is a concrete design reason to change it.
- Favor data-first JSX behavior for lowercase tags.
- Be careful when changing anything in `src/internal.ts`; it affects both runtime behavior and tests.
- When updating JSX behavior, also update:
  - `test/runtime.test.mjs`
  - `test/consumer.tsx`
  - any relevant docs in `README.md`

## Publishing Notes

Before publishing:

```sh
npm test
npm pack --dry-run
```

Check `package.json` exports and confirm the published package name is correct.

