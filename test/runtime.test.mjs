import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { Elem } from '../dist/index.mjs';
import { Fragment, jsx, jsxs } from '../dist/jsx-runtime.mjs';

const require = createRequire(import.meta.url);

class CustomComponent {
	constructor(name = 'custom') {
		this.name = name;
	}

	render() {}

	unrender() {}

	static fromJSX(props) {
		return new CustomComponent(props?.name);
	}
}

test('lowercase JSX tags become structured JSX objects', () => {
	const node = jsxs('div', {
		className: 'example',
		nodeId: 'root',
		children: [
			'Hello',
			jsx('span', { children: 'world' }),
		],
	});

	assert.equal(node.type, 'div');
	assert.equal(node.props.className, 'example');
	assert.equal(node.props.nodeId, 'root');
	assert.equal(node.props.children.length, 2);
	assert.deepEqual(node.props.children[0], { text: 'Hello' });
	assert.equal(node.props.children[1].type, 'span');
	assert.deepEqual(node.props.children[1].props.children, [ { text: 'world' } ]);
});

test('lowercase JSX tags support class as an alias for className', () => {
	const aliased = jsx('div', { class: 'from-class' });
	const explicit = jsx('div', {
		class: 'from-class',
		className: 'from-className',
	});

	assert.equal(aliased.props.className, 'from-class');
	assert.equal(Object.prototype.hasOwnProperty.call(aliased.props, 'class'), false);
	assert.equal(explicit.props.className, 'from-className');
	assert.equal(Object.prototype.hasOwnProperty.call(explicit.props, 'class'), false);
});

test('Elem JSX tags return Elem instances', () => {
	const elem = jsx(Elem, {
		as: 'section',
		children: jsx('span', { children: 'Hello' }),
	});

	assert.ok(elem instanceof Elem);
	assert.equal(elem.getJsx().type, 'section');
	assert.equal(elem.getJsx().props.children[0].type, 'span');
	assert.equal(typeof elem.render, 'function');
	assert.equal(typeof elem.getElement, 'function');
});

test('Elem can be constructed from a structured JSX object', () => {
	const elem = new Elem({
		type: 'div',
		props: {
			className: 'direct',
			children: [ { text: 'Hello' } ],
		},
	});

	assert.ok(elem instanceof Elem);
	assert.equal(elem.getJsx().type, 'div');
	assert.equal(elem.getJsx().props.className, 'direct');
	assert.deepEqual(elem.getJsx().props.children, [ { text: 'Hello' } ]);
	assert.equal(typeof elem.render, 'function');
	assert.equal(typeof elem.getElement, 'function');
});

test('Elem JSX defaults as to div and rejects non-string values', () => {
	const fallback = jsx(Elem, {});

	assert.ok(fallback instanceof Elem);
	assert.equal(fallback.getJsx().type, 'div');
	assert.equal(Object.prototype.hasOwnProperty.call(fallback.getJsx().props, 'as'), false);
	assert.equal(typeof fallback.render, 'function');

	assert.throws(() => {
		jsx(Elem, { as: 1 });
	}, /Elem JSX as must be a string/);
});

test('capitalized JSX tags call fromJSX(props)', () => {
	const component = jsx(CustomComponent, { name: 'example' });

	assert.ok(component instanceof CustomComponent);
	assert.equal(component.name, 'example');
});

test('rejects component tags without fromJSX', () => {
	function PlainComponent() {}

	assert.throws(() => {
		jsx(PlainComponent, {});
	}, /must expose a static fromJSX/);
});

test('rejects invalid fromJSX return values', () => {
	class InvalidComponent {
		static fromJSX() {
			return { type: 'div', props: {} };
		}
	}

	assert.throws(() => {
		jsx(InvalidComponent, {});
	}, /must return a component instance/);
});

test('normalizes strings, numbers, arrays, empty values, and embedded components', () => {
	const component = new CustomComponent();
	const node = jsxs('div', {
		children: [
			'start',
			7,
			null,
			false,
			undefined,
			[ jsx('span', { children: 'nested' }), component ],
		],
	});

	assert.equal(node.props.children.length, 4);
	assert.deepEqual(node.props.children[0], { text: 'start' });
	assert.deepEqual(node.props.children[1], { text: '7' });
	assert.equal(node.props.children[2].type, 'span');
	assert.equal(node.props.children[3].component, component);
});

test('preserves nodeId metadata for embedded component children', () => {
	const node = jsx('div', {
		children: jsx(CustomComponent, {
			nodeId: 'child-node',
			name: 'embedded',
		}),
	});

	assert.equal(node.props.children.length, 1);
	assert.equal(node.props.children[0].nodeId, 'child-node');
	assert.ok(node.props.children[0].component instanceof CustomComponent);
});

test('rejects fragment syntax', () => {
	assert.throws(() => {
		jsx(Fragment, {});
	}, /fragments are not supported/);
});

test('exports package surface for ESM, CJS, and types', async () => {
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
	const cjsIndex = require('../dist/index.cjs');
	const cjsRuntime = require('../dist/jsx-runtime.cjs');

	assert.equal(pkg.main, './dist/index.cjs');
	assert.equal(pkg.module, './dist/index.mjs');
	assert.equal(pkg.types, './dist/index.d.ts');
	assert.ok(existsSync(new URL('../dist/index.mjs', import.meta.url)));
	assert.ok(existsSync(new URL('../dist/index.cjs', import.meta.url)));
	assert.ok(existsSync(new URL('../dist/index.d.ts', import.meta.url)));
	assert.ok(existsSync(new URL('../dist/jsx-runtime.mjs', import.meta.url)));
	assert.ok(existsSync(new URL('../dist/jsx-runtime.cjs', import.meta.url)));
	assert.ok(existsSync(new URL('../dist/jsx-runtime.d.ts', import.meta.url)));
	assert.equal(typeof cjsIndex.Elem, 'function');
	assert.equal(typeof cjsRuntime.jsx, 'function');
	assert.equal(typeof cjsRuntime.jsxs, 'function');
});
