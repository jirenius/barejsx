import type {
	Component,
	JsxChild,
	JsxComponentNode,
	JsxComponentType,
	JsxElementObject,
	JsxElementProps,
	JsxNormalizedChild,
	JsxTextNode,
} from './types';

const jsxNodeIdProp = Symbol.for('barejsx.jsxNodeId');
const Fragment = { __barejsxFragment: true } as const;

function hasOwn<T extends object>(obj: T | null | undefined, key: PropertyKey): boolean {
	return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function isComponent(value: unknown): value is Component {
	return !!value &&
		typeof value === 'object' &&
		typeof (value as Component).render === 'function' &&
		typeof (value as Component).unrender === 'function';
}

function isJsxElementObject(value: unknown): value is JsxElementObject {
	return !!value &&
		typeof value === 'object' &&
		typeof (value as JsxElementObject).type === 'string' &&
		!!(value as JsxElementObject).props &&
		typeof (value as JsxElementObject).props === 'object';
}

function isTextNode(value: unknown): value is JsxTextNode {
	return !!value &&
		typeof value === 'object' &&
		typeof (value as JsxTextNode).text === 'string';
}

function isComponentNode(value: unknown): value is JsxComponentNode {
	return !!value &&
		typeof value === 'object' &&
		isComponent((value as JsxComponentNode).component);
}

function getUnsupportedTypeError(type: unknown): Error {
	if (type === Fragment) {
		return new Error("JSX fragments are not supported.");
	}

	return new Error("JSX component tags must expose a static fromJSX(props) adapter.");
}

function getInvalidAdapterError(type: unknown): Error {
	const name = type && typeof type === 'object' && 'name' in type && typeof type.name === 'string'
		? type.name
		: typeof type === 'function' && type.name
			? type.name
			: 'Component';

	return new Error(name + ".fromJSX(props) must return a component instance.");
}

function setJsxNodeId(component: Component, nodeId: unknown): Component {
	if (typeof nodeId === 'undefined') {
		return component;
	}

	Object.defineProperty(component, jsxNodeIdProp, {
		configurable: true,
		enumerable: false,
		value: nodeId,
		writable: true,
	});

	return component;
}

function getJsxNodeId(component: Component): string | undefined {
	const value = (component as Component & Record<PropertyKey, unknown>)[jsxNodeIdProp];
	return typeof value === 'string'
		? value
		: undefined;
}

function normalizeProps(props: Record<string, unknown> | null | undefined): JsxElementProps {
	const normalized: JsxElementProps = {};
	const source = props || {};

	for (const key in source) {
		if (!hasOwn(source, key) || key === 'key' || key === 'ref' || key === '__self' || key === '__source') {
			continue;
		}

		if (key === 'children') {
			continue;
		}

		normalized[key] = source[key];
	}

	const children = normalizeJsxChildren(source.children as JsxChild);
	if (children.length) {
		normalized.children = children;
	}

	return normalized;
}

function pushJsxChild(list: JsxNormalizedChild[], child: JsxChild): void {
	if (child === null || typeof child === 'undefined' || typeof child === 'boolean') {
		return;
	}

	if (Array.isArray(child)) {
		for (let i = 0; i < child.length; i++) {
			pushJsxChild(list, child[i] as JsxChild);
		}
		return;
	}

	if (typeof child === 'string' || typeof child === 'number') {
		list.push({ text: String(child) });
		return;
	}

	if (isJsxElementObject(child) || isTextNode(child) || isComponentNode(child)) {
		list.push(child);
		return;
	}

	if (isComponent(child)) {
		const node: JsxComponentNode = { component: child };
		const nodeId = getJsxNodeId(child);
		if (nodeId) {
			node.nodeId = nodeId;
		}
		list.push(node);
		return;
	}

	throw new Error("Unsupported JSX child type.");
}

function normalizeJsxChildren(children: JsxChild): JsxNormalizedChild[] {
	const list: JsxNormalizedChild[] = [];
	pushJsxChild(list, children);
	return list;
}

function createStructuredElement(type: string, props: Record<string, unknown> | null | undefined): JsxElementObject {
	return {
		type,
		props: normalizeProps(props),
	};
}

function createJsxValue(type: string | JsxComponentType<any> | typeof Fragment, props?: Record<string, unknown> | null): JsxElementObject | Component {
	if (typeof type === 'string') {
		return createStructuredElement(type, props);
	}

	if (type === Fragment || !type || typeof (type as JsxComponentType<any>).fromJSX !== 'function') {
		throw getUnsupportedTypeError(type);
	}

	const componentType = type as JsxComponentType<any>;
	const component = componentType.fromJSX((props || {}) as never);
	if (!isComponent(component)) {
		throw getInvalidAdapterError(type);
	}

	if (hasOwn(props, 'nodeId')) {
		setJsxNodeId(component, props?.nodeId);
	}

	return component;
}

export {
	Fragment,
	createJsxValue,
	getJsxNodeId,
	hasOwn,
	isComponent,
	normalizeJsxChildren,
	setJsxNodeId,
};
