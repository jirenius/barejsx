# barejsx

Standalone JSX-native component primitives for simple `render` / `unrender` components.

## Install

```sh
npm install barejsx
```

## TypeScript / JSX setup

Use the package itself as the JSX import source:

```json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "barejsx"
	}
}
```

## Usage

```tsx
import { Elem } from 'barejsx';

const elem = <Elem as="section">
	<div class="example">
		<span>Hello</span>
	</div>
</Elem>;

elem.render(document.body);
```
