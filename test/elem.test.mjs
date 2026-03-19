import assert from 'node:assert/strict';
import test from 'node:test';

import { Elem } from '../dist/index.mjs';
import { jsx, jsxs } from '../dist/jsx-runtime.mjs';

class MockNode {
	constructor() {
		this.parentNode = null;
		this.childNodes = [];
	}

	appendChild(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
		node.parentNode = this;
		this.childNodes.push(node);
		return node;
	}

	removeChild(node) {
		const index = this.childNodes.indexOf(node);
		if (index === -1) {
			throw new Error('Node is not a child.');
		}
		this.childNodes.splice(index, 1);
		node.parentNode = null;
		return node;
	}

	get lastChild() {
		return this.childNodes.length
			? this.childNodes[this.childNodes.length - 1]
			: null;
	}
}

class MockText extends MockNode {
	constructor(text) {
		super();
		this.nodeType = 3;
		this.textContent = text;
	}
}

class MockElement extends MockNode {
	constructor(tagName) {
		super();
		this.nodeType = 1;
		this.tagName = tagName.toUpperCase();
		this.attributes = {};
		this.style = {};
		this.className = '';
		this.listeners = {};
	}

	setAttribute(name, value) {
		this.attributes[name] = String(value);
	}

	removeAttribute(name) {
		delete this.attributes[name];
	}

	addEventListener(name, callback) {
		this.listeners[name] = this.listeners[name] || [];
		this.listeners[name].push(callback);
	}

	removeEventListener(name, callback) {
		const listeners = this.listeners[name];
		if (!listeners) {
			return;
		}

		this.listeners[name] = listeners.filter(listener => listener !== callback);
	}

	dispatch(name, event = {}) {
		const listeners = this.listeners[name] || [];
		for (const listener of listeners.slice()) {
			listener(event);
		}
	}
}

function installMockDocument() {
	globalThis.document = {
		createElement(tagName) {
			return new MockElement(tagName);
		},
		createTextNode(text) {
			return new MockText(text);
		},
	};
}

class EmbeddedComponent {
	constructor(label = 'embedded') {
		this.label = label;
		this.renderCalls = 0;
		this.unrenderCalls = 0;
		this.el = null;
	}

	render(parent) {
		this.renderCalls += 1;
		this.el = document.createElement('strong');
		this.el.textContent = this.label;
		parent.appendChild(this.el);
	}

	unrender() {
		this.unrenderCalls += 1;
		if (this.el?.parentNode) {
			this.el.parentNode.removeChild(this.el);
		}
		this.el = null;
	}

	static fromJSX(props) {
		return new EmbeddedComponent(props?.label || 'embedded');
	}
}

installMockDocument();

test('Elem renders DOM and embedded children in order', () => {
	const embedded = new EmbeddedComponent('direct');
	const elem = jsx(Elem, {
		as: 'section',
		className: 'example',
		id: 'root-id',
		children: [
			jsx('h1', { children: 'Hello' }),
			embedded,
			jsx(EmbeddedComponent, { label: 'capitalized' }),
		],
	});
	const parent = document.createElement('div');

	elem.render(parent);

	assert.equal(parent.childNodes.length, 1);
	assert.equal(elem.getElement().tagName, 'SECTION');
	assert.equal(elem.getElement().className, 'example');
	assert.equal(elem.getElement().attributes.id, 'root-id');
	assert.equal(elem.getElement().childNodes[0].tagName, 'H1');
	assert.equal(elem.getElement().childNodes[0].childNodes[0].textContent, 'Hello');
	assert.equal(elem.getElement().childNodes[1].tagName, 'STRONG');
	assert.equal(elem.getElement().childNodes[1].textContent, 'direct');
	assert.equal(elem.getElement().childNodes[2].textContent, 'capitalized');
	assert.equal(embedded.renderCalls, 1);
});

test('Elem rejects double render and no-ops repeated unrender', () => {
	const elem = new Elem({
		type: 'div',
		props: {},
	});
	const parent = document.createElement('div');

	elem.render(parent);
	assert.throws(() => elem.render(parent), /Already rendered/);

	elem.unrender();
	assert.equal(parent.childNodes.length, 0);
	elem.unrender();
});

test('Elem getElement and getNode use nodeId lookup semantics', () => {
	const child = new EmbeddedComponent('child');
	const elem = new Elem({
		type: 'div',
		props: {
			nodeId: 'root',
			children: [
				{ type: 'span', props: { nodeId: 'title', children: [ { text: 'Hello' } ] } },
				{ component: child, nodeId: 'component' },
			],
		},
	});
	const parent = document.createElement('div');

	assert.equal(elem.getElement(), null);
	assert.equal(elem.getNode('root'), null);
	assert.equal(elem.getNode('component'), child);

	elem.render(parent);

	assert.equal(elem.getNode('root').tagName, 'DIV');
	assert.equal(elem.getNode('title').tagName, 'SPAN');
	assert.equal(elem.getNode('component'), child);
});

test('Elem rejects duplicate nodeId values during construction', () => {
	assert.throws(() => new Elem({
		type: 'div',
		props: {
			nodeId: 'dup',
			children: [
				{ type: 'span', props: { nodeId: 'dup' } },
			],
		},
	}), /used multiple times/);
});

test('mutation helpers update model before render and DOM after render', () => {
	const elem = new Elem({
		type: 'button',
		props: {
			nodeId: 'root',
			children: [
				{ type: 'span', props: { nodeId: 'label', children: [ { text: 'Click' } ] } },
			],
		},
	});

	elem.addClass('alpha')
		.addNodeClass('label', 'beta')
		.setAttribute('data-id', 7)
		.setProperty('value', 'send')
		.setStyle('color', 'red');

	assert.equal(elem.hasClass('alpha'), true);
	assert.equal(elem.hasNodeClass('label', 'beta'), true);
	assert.equal(elem.getProperty('value'), 'send');
	assert.equal(elem.getStyle('color'), 'red');

	const parent = document.createElement('div');
	elem.render(parent);

	assert.equal(elem.getElement().className, 'alpha');
	assert.equal(elem.getElement().attributes['data-id'], '7');
	assert.equal(elem.getElement().value, 'send');
	assert.equal(elem.getElement().style.color, 'red');
	assert.equal(elem.getNode('label').className, 'beta');

	elem.setNodeAttribute('label', 'title', 'label');
	assert.equal(elem.getNode('label').attributes.title, 'label');

	elem.removeClass('alpha');
	elem.removeNodeAttribute('label', 'title');
	assert.equal(elem.hasClass('alpha'), false);
	assert.equal(elem.getElement().className, '');
	assert.equal('title' in elem.getNode('label').attributes, false);
});

test('event helpers call callbacks with configured context', () => {
	const calls = [];
	const elem = new Elem({
		type: 'button',
		props: {},
	});
	const parent = document.createElement('div');

	elem.setContext({ scope: 'ctx' });
	elem.setEvent('click', (ctx, event) => {
		calls.push([ ctx, event ]);
	});
	elem.render(parent);

	elem.getElement().dispatch('click', { type: 'click' });
	assert.deepEqual(calls, [
		[ { scope: 'ctx' }, { type: 'click' } ],
	]);

	elem.removeEvent('click');
	elem.getElement().dispatch('click', { type: 'click-2' });
	assert.equal(calls.length, 1);
});

test('unrender removes DOM and calls child component unrender', () => {
	const embedded = new EmbeddedComponent('bye');
	const elem = new Elem({
		type: 'div',
		props: {
			children: [ { component: embedded } ],
		},
	});
	const parent = document.createElement('div');

	elem.render(parent);
	assert.equal(parent.childNodes.length, 1);

	elem.unrender();

	assert.equal(parent.childNodes.length, 0);
	assert.equal(elem.getElement(), null);
	assert.equal(embedded.unrenderCalls, 1);
});
