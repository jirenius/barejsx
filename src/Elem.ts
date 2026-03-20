import { createStructuredElement, hasOwn } from './internal';
import type {
	Component,
	ElemEventCallback,
	ElemInput,
	ElemProps,
	JsxComponentNode,
	JsxElementObject,
	JsxExpression,
	JsxElementProps,
	JsxNormalizedChild,
	JsxTextNode,
} from './types';

const RESERVED_PROP_NAMES: Record<string, true> = {
	attributes: true,
	children: true,
	className: true,
	events: true,
	nodeId: true,
	properties: true,
	style: true,
};

const DIRECT_PROPERTY_NAMES: Record<string, true> = {
	checked: true,
	disabled: true,
	multiple: true,
	readOnly: true,
	selected: true,
	selectedIndex: true,
	tabIndex: true,
	value: true,
};

interface PreparedElementNode {
	kind: 'element';
	model: JsxElementObject;
	el: Element | null;
	children: PreparedNode[];
	eventListeners: Record<string, EventListener>;
}

interface PreparedTextNode {
	kind: 'text';
	model: JsxTextNode;
	el: Text | null;
}

interface PreparedComponentNode {
	kind: 'component';
	model: JsxComponentNode;
}

type PreparedNode = PreparedElementNode | PreparedTextNode | PreparedComponentNode;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isJsxElementObject(value: JsxNormalizedChild): value is JsxElementObject {
	return 'type' in value && typeof value.type === 'string';
}

function isJsxTextNode(value: JsxNormalizedChild): value is JsxTextNode {
	return 'text' in value && typeof value.text === 'string';
}

function isJsxComponentNode(value: JsxNormalizedChild): value is JsxComponentNode {
	return 'component' in value &&
		!!value.component &&
		typeof value.component === 'object' &&
		typeof value.component.render === 'function' &&
		typeof value.component.unrender === 'function';
}

function isElementNode(node: PreparedNode): node is PreparedElementNode {
	return node.kind === 'element';
}

function isTextNode(node: PreparedNode): node is PreparedTextNode {
	return node.kind === 'text';
}

function getElementNodeId(model: JsxElementObject): string | undefined {
	return typeof model.props.nodeId === 'string'
		? model.props.nodeId
		: undefined;
}

function getPreparedNodeId(node: PreparedNode): string | undefined {
	if (node.kind === 'element') {
		return getElementNodeId(node.model);
	}

	if (node.kind === 'component') {
		return typeof node.model.nodeId === 'string'
			? node.model.nodeId
			: undefined;
	}

	return undefined;
}

function getEventName(propName: string): string | null {
	if (!/^on[A-Z]/.test(propName)) {
		return null;
	}

	return propName.slice(2).toLowerCase();
}

function getPropertyBucket(props: JsxElementProps): Record<string, unknown> {
	const bucket = props.properties;
	if (!isObjectRecord(bucket)) {
		return {};
	}
	return bucket;
}

function getAttributeBucket(props: JsxElementProps): Record<string, unknown> {
	const bucket = props.attributes;
	if (!isObjectRecord(bucket)) {
		return {};
	}
	return bucket;
}

function getStyleBucket(props: JsxElementProps): Record<string, string | number> {
	const bucket = props.style;
	if (!isObjectRecord(bucket)) {
		return {};
	}
	return bucket as Record<string, string | number>;
}

function getEventBucket(props: JsxElementProps): Record<string, ElemEventCallback> {
	const bucket = props.events;
	if (!isObjectRecord(bucket)) {
		return {};
	}
	return bucket as Record<string, ElemEventCallback>;
}

function setClassNameValue(props: JsxElementProps, className: string | null): void {
	if (className) {
		props.className = className;
	} else {
		delete props.className;
	}
}

function getClassNameValue(props: JsxElementProps): string | null {
	const className = props.className;
	if (Array.isArray(className)) {
		return className.join(' ').trim() || null;
	}

	return typeof className === 'string' && className.trim()
		? className
		: null;
}

function applyAttribute(el: Element, name: string, value: unknown): void {
	el.setAttribute(name, String(value));
}

function applyStyleValue(el: HTMLElement, name: string, value: string | number): void {
	el.style[name as never] = String(value);
}

function setElementProperty(el: Element, name: string, value: unknown): unknown {
	(el as unknown as Record<string, unknown>)[name] = value;
	return (el as unknown as Record<string, unknown>)[name];
}

function getElementProperty(el: Element, name: string): unknown {
	return (el as unknown as Record<string, unknown>)[name];
}

function collectInitialAttributes(props: JsxElementProps): Record<string, unknown> {
	const attributes: Record<string, unknown> = {};

	for (const key in props) {
		if (!hasOwn(props, key) || key in RESERVED_PROP_NAMES) {
			continue;
		}

		const value = props[key];
		const eventName = getEventName(key);
		if (eventName || DIRECT_PROPERTY_NAMES[key]) {
			continue;
		}

		if (key === 'htmlFor') {
			attributes.for = value;
			continue;
		}

		if (typeof value === 'boolean') {
			if (value) {
				attributes[key] = '';
			}
			continue;
		}

		if (value !== null && typeof value !== 'undefined') {
			attributes[key] = value;
		}
	}

	return Object.assign(attributes, getAttributeBucket(props));
}

function collectInitialProperties(props: JsxElementProps): Record<string, unknown> {
	const properties: Record<string, unknown> = {};

	for (const key in props) {
		if (!hasOwn(props, key) || key in RESERVED_PROP_NAMES) {
			continue;
		}

		if (DIRECT_PROPERTY_NAMES[key]) {
			properties[key] = props[key];
		}
	}

	return Object.assign(properties, getPropertyBucket(props));
}

function collectInitialEvents(props: JsxElementProps): Record<string, ElemEventCallback> {
	const events: Record<string, ElemEventCallback> = {};

	for (const key in props) {
		if (!hasOwn(props, key) || key in RESERVED_PROP_NAMES) {
			continue;
		}

		const eventName = getEventName(key);
		if (!eventName) {
			continue;
		}

		const callback = props[key];
		if (typeof callback === 'function') {
			events[eventName] = callback as ElemEventCallback;
		}
	}

	return Object.assign(events, getEventBucket(props));
}

function prepareNode(
	node: JsxNormalizedChild,
	idNode: Record<string, PreparedNode>,
): PreparedNode {
	if (isJsxElementObject(node)) {
		const prepared: PreparedElementNode = {
			kind: 'element',
			model: node,
			el: null,
			children: [],
			eventListeners: {},
		};

		const nodeId = getElementNodeId(node);
		if (nodeId) {
			if (idNode[nodeId]) {
				throw new Error("Node id " + nodeId + " used multiple times.");
			}
			idNode[nodeId] = prepared;
		}

		const children = Array.isArray(node.props.children)
			? node.props.children
			: [];

		prepared.children = children.map(child => prepareNode(child, idNode));
		return prepared;
	}

	if (isJsxTextNode(node)) {
		return {
			kind: 'text',
			model: node,
			el: null,
		};
	}

	if (isJsxComponentNode(node)) {
		const prepared: PreparedComponentNode = {
			kind: 'component',
			model: node,
		};

		const nodeId = getPreparedNodeId(prepared);
		if (nodeId) {
			if (idNode[nodeId]) {
				throw new Error("Node id " + nodeId + " used multiple times.");
			}
			idNode[nodeId] = prepared;
		}

		return prepared;
	}

	throw new Error("Unsupported JSX child type.");
}

function prepareJsxRoot(element: JsxExpression): {
	node: PreparedElementNode;
	idNode: Record<string, PreparedNode>;
} {
	// `Elem` accepts a broad JSX expression type but only element-rooted values are valid here.
	if (!element ||
		typeof element !== 'object' ||
		!('type' in element) ||
		typeof element.type !== 'string' ||
		!('props' in element) ||
		!isObjectRecord(element.props)
	) {
		throw new Error("Elem requires a structured JSX element object.");
	}

	const idNode: Record<string, PreparedNode> = {};
	const node = prepareNode(element, idNode) as PreparedElementNode;
	return { node, idNode };
}

function getPreparedNode(idNode: Record<string, PreparedNode>, id: string): PreparedNode {
	const node = idNode[id];
	if (!node) {
		throw new Error("Unknown node id: " + id);
	}
	return node;
}

function getElementPreparedNode(idNode: Record<string, PreparedNode>, id: string): PreparedElementNode {
	const node = getPreparedNode(idNode, id);
	if (!isElementNode(node)) {
		throw new Error("Node must be of type element.");
	}
	return node;
}

function renderPreparedNode(ctx: unknown, parent: ParentNode, node: PreparedNode): Node {
	if (isElementNode(node)) {
		const el = document.createElement(node.model.type);
		const props = node.model.props;

		const attributes = collectInitialAttributes(props);
		for (const key in attributes) {
			if (hasOwn(attributes, key)) {
				applyAttribute(el, key, attributes[key]);
			}
		}

		const properties = collectInitialProperties(props);
		for (const key in properties) {
			if (hasOwn(properties, key)) {
				setElementProperty(el, key, properties[key]);
			}
		}

		// Clone the style bucket so the render pass applies a stable snapshot of the model.
		const styles = Object.assign({}, getStyleBucket(props));
		for (const key in styles) {
			if (hasOwn(styles, key)) {
				applyStyleValue(el as HTMLElement, key, styles[key]);
			}
		}

		const className = getClassNameValue(props);
		if (className) {
			(el as HTMLElement).className = className;
		}

		const events = collectInitialEvents(props);
		node.eventListeners = {};
		for (const key in events) {
			if (hasOwn(events, key)) {
				const listener = (event: Event) => {
					events[key](ctx, event);
				};
				el.addEventListener(key, listener);
				node.eventListeners[key] = listener;
			}
		}

		node.el = el;
		parent.appendChild(el);

		for (let i = 0; i < node.children.length; i++) {
			renderPreparedNode(ctx, el, node.children[i]);
		}

		return el;
	}

	if (isTextNode(node)) {
		const text = document.createTextNode(node.model.text);
		node.el = text;
		parent.appendChild(text);
		return text;
	}

	node.model.component.render(parent);
	return parent.lastChild as Node;
}

function unrenderPreparedNode(node: PreparedNode): void {
	if (isElementNode(node)) {
		for (let i = 0; i < node.children.length; i++) {
			unrenderPreparedNode(node.children[i]);
		}

		if (node.el) {
			for (const key in node.eventListeners) {
				if (hasOwn(node.eventListeners, key)) {
					node.el.removeEventListener(key, node.eventListeners[key]);
				}
			}

			const properties = getPropertyBucket(node.model.props);
			for (const key in properties) {
				if (hasOwn(properties, key)) {
					properties[key] = getElementProperty(node.el, key);
				}
			}

			const styles = getStyleBucket(node.model.props);
			for (const key in styles) {
				if (hasOwn(styles, key)) {
					styles[key] = (node.el as HTMLElement).style[key as never] as string;
				}
			}

			setClassNameValue(node.model.props, (node.el as HTMLElement).className || null);
		}

		node.eventListeners = {};
		node.el = null;
		return;
	}

	if (isTextNode(node)) {
		node.el = null;
		return;
	}

	node.model.component.unrender();
}

function setPreparedNodeClassName(node: PreparedElementNode, className: string | null): void {
	setClassNameValue(node.model.props, className && className.trim() ? className.trim() : null);
	if (node.el) {
		(node.el as HTMLElement).className = getClassNameValue(node.model.props) || '';
	}
}

function addClassToPreparedNode(node: PreparedElementNode, className: string): void {
	const classNames = new Set((getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean));
	const normalized = className.trim();
	if (!normalized || classNames.has(normalized)) {
		return;
	}

	classNames.add(normalized);
	setPreparedNodeClassName(node, Array.from(classNames).join(' '));
}

function removeClassFromPreparedNode(node: PreparedElementNode, className: string): void {
	const classNames = (getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean);
	const normalized = className.trim();
	const filtered = classNames.filter(value => value !== normalized);
	if (filtered.length === classNames.length) {
		return;
	}

	setPreparedNodeClassName(node, filtered.join(' ') || null);
}

function hasClassOnPreparedNode(node: PreparedElementNode, className: string): boolean {
	const normalized = className.trim();
	return (getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean).includes(normalized);
}

function setPreparedNodeAttribute(node: PreparedElementNode, name: string, value: unknown): void {
	// Ensure the mutable attribute bucket exists before mutating the JSX model.
	if (!isObjectRecord(node.model.props.attributes)) {
		node.model.props.attributes = {};
	}
	const attributes = node.model.props.attributes as Record<string, unknown>;
	attributes[name] = value;

	if (node.el) {
		applyAttribute(node.el, name, value);
	}
}

function removePreparedNodeAttribute(node: PreparedElementNode, name: string): void {
	const attributes = getAttributeBucket(node.model.props);
	if (hasOwn(attributes, name)) {
		delete attributes[name];
	}

	if (node.el) {
		node.el.removeAttribute(name);
	}
}

function setPreparedNodeProperty(node: PreparedElementNode, name: string, value: unknown): void {
	// Ensure the mutable property bucket exists before mutating the JSX model.
	if (!isObjectRecord(node.model.props.properties)) {
		node.model.props.properties = {};
	}
	const properties = node.model.props.properties as Record<string, unknown>;
	properties[name] = value;

	if (node.el) {
		properties[name] = setElementProperty(node.el, name, value);
	}
}

function getPreparedNodeProperty(node: PreparedElementNode, name: string): unknown {
	if (node.el) {
		return getElementProperty(node.el, name);
	}

	const properties = getPropertyBucket(node.model.props);
	if (hasOwn(properties, name)) {
		return properties[name];
	}

	if (DIRECT_PROPERTY_NAMES[name] && hasOwn(node.model.props, name)) {
		return node.model.props[name];
	}

	return undefined;
}

function setPreparedNodeStyle(node: PreparedElementNode, name: string, value: string | number): void {
	// Ensure the mutable style bucket exists before mutating the JSX model.
	if (!isObjectRecord(node.model.props.style)) {
		node.model.props.style = {};
	}
	const style = node.model.props.style as Record<string, string | number>;
	style[name] = value;

	if (node.el) {
		applyStyleValue(node.el as HTMLElement, name, value);
		style[name] = (node.el as HTMLElement).style[name as never] as string;
	}
}

function getPreparedNodeStyle(node: PreparedElementNode, name: string): string | number | undefined {
	if (node.el) {
		return (node.el as HTMLElement).style[name as never] as string;
	}

	return getStyleBucket(node.model.props)[name];
}

function setPreparedNodeEvent(
	ctx: unknown,
	node: PreparedElementNode,
	event: string,
	callback?: ElemEventCallback | null,
): void {
	// Ensure the mutable event bucket exists before mutating the JSX model.
	if (!isObjectRecord(node.model.props.events)) {
		node.model.props.events = {};
	}
	const events = node.model.props.events as Record<string, ElemEventCallback>;
	const currentListener = node.eventListeners[event];
	if (node.el && currentListener) {
		node.el.removeEventListener(event, currentListener);
		delete node.eventListeners[event];
	}

	if (!callback) {
		if (hasOwn(events, event)) {
			delete events[event];
		}
		return;
	}

	events[event] = callback;
	if (node.el) {
		const listener = (ev: Event) => {
			callback(ctx, ev);
		};
		node.el.addEventListener(event, listener);
		node.eventListeners[event] = listener;
	}
}

/**
 * Renderable element component.
 *
 * When used through JSX, `Elem` defaults to the tag name `'div'`.
 * Set the JSX prop `as` to use another tag name, for example:
 *
 * ```tsx
 * <Elem as="section" />
 * ```
 */
class Elem implements Component {
	/**
	 * Creates a new element component.
	 * @param element JSX expression whose runtime value must be a structured JSX element object.
	 */
	private node!: PreparedElementNode;
	private idNode!: Record<string, PreparedNode>;
	private ctx: unknown;
	private el: Node | null = null;

	constructor(element: JsxExpression) {
		this.ctx = this;
		this.applyJsx(element);
	}

	/**
	 * Creates an `Elem` instance from JSX props.
	 *
	 * The default tag name is `'div'`. Use the JSX prop `as` to choose
	 * another tag name.
	 */
	static fromJSX(props: ElemProps): Elem {
		const hasAs = Object.prototype.hasOwnProperty.call(props, 'as');
		const tagName = hasAs
			? props.as
			: 'div';

		if (typeof tagName !== 'string') {
			throw new Error("Elem JSX as must be a string.");
		}

		const elementProps = hasAs
			? Object.assign({}, props)
			: props;

		if (hasAs) {
			delete elementProps.as;
		}

		return new Elem(createStructuredElement(tagName, elementProps));
	}

	/**
	 * Replaces the current root JSX element.
	 * May not be called while rendered.
	 * @param element JSX expression whose runtime value must be a structured JSX element object.
	 * @returns The current instance.
	 */
	setJsx(element: JsxExpression): this {
		if (this.el) {
			throw new Error("Call to setJsx while rendered.");
		}

		this.applyJsx(element);

		return this;
	}

	private applyJsx(element: JsxExpression): void {
		const prepared = prepareJsxRoot(element);
		this.idNode = prepared.idNode;
		this.node = prepared.node;
	}

	/**
	 * Renders the stored element tree into a parent node.
	 * Throws if the component is already rendered.
	 * @param el Parent DOM node to render into.
	 */
	render(el: ParentNode): void {
		if (this.el) {
			throw new Error("Already rendered.");
		}

		this.el = renderPreparedNode(this.ctx, el, this.node);
	}

	/**
	 * Unrenders the current element tree and removes its root DOM node.
	 * Does nothing if the component is not currently rendered.
	 */
	unrender(): void {
		if (!this.el) {
			return;
		}

		unrenderPreparedNode(this.node);

		if (this.el.parentNode) {
			this.el.parentNode.removeChild(this.el);
		}

		this.el = null;
	}

	/**
	 * Gets the current rendered root node.
	 * @returns The rendered root DOM node, or `null` if not rendered.
	 */
	getElement(): Node | null {
		return this.el;
	}

	/**
	 * Gets the current structured JSX root object.
	 * @returns The current root JSX element object.
	 */
	getJsx(): JsxElementObject {
		return this.node.model;
	}

	/**
	 * Gets a rendered node or embedded component by `nodeId`.
	 * @param nodeId Node identifier from the JSX structure.
	 * @returns A rendered DOM node, embedded component, or `null` for non-component nodes before render.
	 */
	getNode(nodeId: string): Node | Component | null {
		const node = getPreparedNode(this.idNode, nodeId);
		return node.kind === 'component'
			? node.model.component
			: node.el;
	}

	/**
	 * Sets the context object passed as the first argument to event callbacks.
	 * @param ctx Event callback context.
	 * @returns The current instance.
	 */
	setContext(ctx: unknown): this {
		this.ctx = ctx;
		return this;
	}

	/**
	 * Adds a class name to the root element.
	 * @param className Class name to add.
	 * @returns The current instance.
	 */
	addClass(className: string): this {
		addClassToPreparedNode(this.node, className);
		return this;
	}

	/**
	 * Adds a class name to a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to add.
	 * @returns The current instance.
	 */
	addNodeClass(nodeId: string, className: string): this {
		addClassToPreparedNode(getElementPreparedNode(this.idNode, nodeId), className);
		return this;
	}

	/**
	 * Removes a class name from the root element.
	 * @param className Class name to remove.
	 * @returns The current instance.
	 */
	removeClass(className: string): this {
		removeClassFromPreparedNode(this.node, className);
		return this;
	}

	/**
	 * Removes a class name from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to remove.
	 * @returns The current instance.
	 */
	removeNodeClass(nodeId: string, className: string): this {
		removeClassFromPreparedNode(getElementPreparedNode(this.idNode, nodeId), className);
		return this;
	}

	/**
	 * Checks whether the root element currently has a class name in the stored model.
	 * @param className Class name to check.
	 * @returns `true` if the class is present.
	 */
	hasClass(className: string): boolean {
		return hasClassOnPreparedNode(this.node, className);
	}

	/**
	 * Checks whether a child element node currently has a class name in the stored model.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to check.
	 * @returns `true` if the class is present.
	 */
	hasNodeClass(nodeId: string, className: string): boolean {
		return hasClassOnPreparedNode(getElementPreparedNode(this.idNode, nodeId), className);
	}

	/**
	 * Replaces the root element class name.
	 * @param className New class name, or `null`/`undefined` to clear it.
	 * @returns The current instance.
	 */
	setClassName(className?: string | null): this {
		setPreparedNodeClassName(this.node, className ?? null);
		return this;
	}

	/**
	 * Replaces the class name of a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className New class name, or `null`/`undefined` to clear it.
	 * @returns The current instance.
	 */
	setNodeClassName(nodeId: string, className?: string | null): this {
		setPreparedNodeClassName(getElementPreparedNode(this.idNode, nodeId), className ?? null);
		return this;
	}

	/**
	 * Sets an attribute on the root element.
	 * @param name Attribute name.
	 * @param value Attribute value.
	 * @returns The current instance.
	 */
	setAttribute(name: string, value: unknown): this {
		setPreparedNodeAttribute(this.node, name, value);
		return this;
	}

	/**
	 * Sets an attribute on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Attribute name.
	 * @param value Attribute value.
	 * @returns The current instance.
	 */
	setNodeAttribute(nodeId: string, name: string, value: unknown): this {
		setPreparedNodeAttribute(getElementPreparedNode(this.idNode, nodeId), name, value);
		return this;
	}

	/**
	 * Removes an attribute from the root element.
	 * @param name Attribute name.
	 * @returns The current instance.
	 */
	removeAttribute(name: string): this {
		removePreparedNodeAttribute(this.node, name);
		return this;
	}

	/**
	 * Removes an attribute from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Attribute name.
	 * @returns The current instance.
	 */
	removeNodeAttribute(nodeId: string, name: string): this {
		removePreparedNodeAttribute(getElementPreparedNode(this.idNode, nodeId), name);
		return this;
	}

	/**
	 * Sets a DOM property on the root element.
	 * @param name Property name.
	 * @param value Property value.
	 * @returns The current instance.
	 */
	setProperty(name: string, value: unknown): this {
		setPreparedNodeProperty(this.node, name, value);
		return this;
	}

	/**
	 * Sets a DOM property on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Property name.
	 * @param value Property value.
	 * @returns The current instance.
	 */
	setNodeProperty(nodeId: string, name: string, value: unknown): this {
		setPreparedNodeProperty(getElementPreparedNode(this.idNode, nodeId), name, value);
		return this;
	}

	/**
	 * Gets a DOM property from the root element.
	 * @param name Property name.
	 * @returns The current or stored property value.
	 */
	getProperty(name: string): unknown {
		return getPreparedNodeProperty(this.node, name);
	}

	/**
	 * Gets a DOM property from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Property name.
	 * @returns The current or stored property value.
	 */
	getNodeProperty(nodeId: string, name: string): unknown {
		return getPreparedNodeProperty(getElementPreparedNode(this.idNode, nodeId), name);
	}

	/**
	 * Sets an inline style value on the root element.
	 * @param name Style property name.
	 * @param value Style value.
	 * @returns The current instance.
	 */
	setStyle(name: string, value: string | number): this {
		setPreparedNodeStyle(this.node, name, value);
		return this;
	}

	/**
	 * Sets an inline style value on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Style property name.
	 * @param value Style value.
	 * @returns The current instance.
	 */
	setNodeStyle(nodeId: string, name: string, value: string | number): this {
		setPreparedNodeStyle(getElementPreparedNode(this.idNode, nodeId), name, value);
		return this;
	}

	/**
	 * Gets an inline style value from the root element.
	 * @param name Style property name.
	 * @returns The current or stored style value.
	 */
	getStyle(name: string): string | number | undefined {
		return getPreparedNodeStyle(this.node, name);
	}

	/**
	 * Gets an inline style value from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Style property name.
	 * @returns The current or stored style value.
	 */
	getNodeStyle(nodeId: string, name: string): string | number | undefined {
		return getPreparedNodeStyle(getElementPreparedNode(this.idNode, nodeId), name);
	}

	/**
	 * Sets the `disabled` property on the root element.
	 * @param disabled Disabled state.
	 * @returns The current instance.
	 */
	setDisabled(disabled: boolean): this {
		return this.setProperty('disabled', disabled);
	}

	/**
	 * Sets the `disabled` property on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param disabled Disabled state.
	 * @returns The current instance.
	 */
	setNodeDisabled(nodeId: string, disabled: boolean): this {
		return this.setNodeProperty(nodeId, 'disabled', disabled);
	}

	/**
	 * Sets or clears an event handler on the root element.
	 * The callback receives the configured context as its first argument.
	 * @param event DOM event name.
	 * @param callback Event callback, or `null`/`undefined` to remove it.
	 * @returns The current instance.
	 */
	setEvent(event: string, callback?: ElemEventCallback | null): this {
		setPreparedNodeEvent(this.ctx, this.node, event, callback);
		return this;
	}

	/**
	 * Removes an event handler from the root element.
	 * @param event DOM event name.
	 * @returns The current instance.
	 */
	removeEvent(event: string): this {
		return this.setEvent(event);
	}

	/**
	 * Sets or clears an event handler on a child element node.
	 * The callback receives the configured context as its first argument.
	 * @param nodeId `nodeId` of the target element node.
	 * @param event DOM event name.
	 * @param callback Event callback, or `null`/`undefined` to remove it.
	 * @returns The current instance.
	 */
	setNodeEvent(nodeId: string, event: string, callback?: ElemEventCallback | null): this {
		setPreparedNodeEvent(this.ctx, getElementPreparedNode(this.idNode, nodeId), event, callback);
		return this;
	}

	/**
	 * Removes an event handler from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param event DOM event name.
	 * @returns The current instance.
	 */
	removeNodeEvent(nodeId: string, event: string): this {
		setPreparedNodeEvent(this.ctx, getElementPreparedNode(this.idNode, nodeId), event);
		return this;
	}
}

export default Elem;
