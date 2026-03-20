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

function isElemInput(value: JsxExpression): value is ElemInput {
	return !!value &&
		typeof value === 'object' &&
		'type' in value &&
		typeof value.type === 'string' &&
		'props' in value &&
		isObjectRecord(value.props);
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

function ensureAttributeBucket(props: JsxElementProps): Record<string, unknown> {
	if (!isObjectRecord(props.attributes)) {
		props.attributes = {};
	}
	return props.attributes as Record<string, unknown>;
}

function ensurePropertyBucket(props: JsxElementProps): Record<string, unknown> {
	if (!isObjectRecord(props.properties)) {
		props.properties = {};
	}
	return props.properties as Record<string, unknown>;
}

function ensureStyleBucket(props: JsxElementProps): Record<string, string | number> {
	if (!isObjectRecord(props.style)) {
		props.style = {};
	}
	return props.style as Record<string, string | number>;
}

function ensureEventBucket(props: JsxElementProps): Record<string, ElemEventCallback> {
	if (!isObjectRecord(props.events)) {
		props.events = {};
	}
	return props.events as Record<string, ElemEventCallback>;
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

function collectInitialStyles(props: JsxElementProps): Record<string, string | number> {
	return Object.assign({}, getStyleBucket(props));
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

function getPropertyValue(props: JsxElementProps, name: string): unknown {
	const properties = getPropertyBucket(props);
	if (hasOwn(properties, name)) {
		return properties[name];
	}

	if (DIRECT_PROPERTY_NAMES[name] && hasOwn(props, name)) {
		return props[name];
	}

	return undefined;
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
		if (!isElemInput(element)) {
			throw new Error("Elem requires a structured JSX element object.");
		}

		this.idNode = {};
		this.node = prepareNode(element, this.idNode) as PreparedElementNode;
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

		this.el = this.renderNode(el, this.node);
	}

	/**
	 * Unrenders the current element tree and removes its root DOM node.
	 * Does nothing if the component is not currently rendered.
	 */
	unrender(): void {
		if (!this.el) {
			return;
		}

		this.unrenderNode(this.node);

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
		const node = this.getPreparedNode(nodeId);
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
		return this.addClassToNode(this.node, className);
	}

	/**
	 * Adds a class name to a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to add.
	 * @returns The current instance.
	 */
	addNodeClass(nodeId: string, className: string): this {
		return this.addClassToNode(this.getElementNode(nodeId), className);
	}

	/**
	 * Removes a class name from the root element.
	 * @param className Class name to remove.
	 * @returns The current instance.
	 */
	removeClass(className: string): this {
		return this.removeClassFromNode(this.node, className);
	}

	/**
	 * Removes a class name from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to remove.
	 * @returns The current instance.
	 */
	removeNodeClass(nodeId: string, className: string): this {
		return this.removeClassFromNode(this.getElementNode(nodeId), className);
	}

	/**
	 * Checks whether the root element currently has a class name in the stored model.
	 * @param className Class name to check.
	 * @returns `true` if the class is present.
	 */
	hasClass(className: string): boolean {
		return this.hasClassOnNode(this.node, className);
	}

	/**
	 * Checks whether a child element node currently has a class name in the stored model.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className Class name to check.
	 * @returns `true` if the class is present.
	 */
	hasNodeClass(nodeId: string, className: string): boolean {
		return this.hasClassOnNode(this.getElementNode(nodeId), className);
	}

	/**
	 * Replaces the root element class name.
	 * @param className New class name, or `null`/`undefined` to clear it.
	 * @returns The current instance.
	 */
	setClassName(className?: string | null): this {
		return this.setNodeClassNameValue(this.node, className ?? null);
	}

	/**
	 * Replaces the class name of a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param className New class name, or `null`/`undefined` to clear it.
	 * @returns The current instance.
	 */
	setNodeClassName(nodeId: string, className?: string | null): this {
		return this.setNodeClassNameValue(this.getElementNode(nodeId), className ?? null);
	}

	/**
	 * Sets an attribute on the root element.
	 * @param name Attribute name.
	 * @param value Attribute value.
	 * @returns The current instance.
	 */
	setAttribute(name: string, value: unknown): this {
		return this.setNodeAttributeValue(this.node, name, value);
	}

	/**
	 * Sets an attribute on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Attribute name.
	 * @param value Attribute value.
	 * @returns The current instance.
	 */
	setNodeAttribute(nodeId: string, name: string, value: unknown): this {
		return this.setNodeAttributeValue(this.getElementNode(nodeId), name, value);
	}

	/**
	 * Removes an attribute from the root element.
	 * @param name Attribute name.
	 * @returns The current instance.
	 */
	removeAttribute(name: string): this {
		return this.removeNodeAttributeValue(this.node, name);
	}

	/**
	 * Removes an attribute from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Attribute name.
	 * @returns The current instance.
	 */
	removeNodeAttribute(nodeId: string, name: string): this {
		return this.removeNodeAttributeValue(this.getElementNode(nodeId), name);
	}

	/**
	 * Sets a DOM property on the root element.
	 * @param name Property name.
	 * @param value Property value.
	 * @returns The current instance.
	 */
	setProperty(name: string, value: unknown): this {
		return this.setNodePropertyValue(this.node, name, value);
	}

	/**
	 * Sets a DOM property on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Property name.
	 * @param value Property value.
	 * @returns The current instance.
	 */
	setNodeProperty(nodeId: string, name: string, value: unknown): this {
		return this.setNodePropertyValue(this.getElementNode(nodeId), name, value);
	}

	/**
	 * Gets a DOM property from the root element.
	 * @param name Property name.
	 * @returns The current or stored property value.
	 */
	getProperty(name: string): unknown {
		return this.getNodePropertyValue(this.node, name);
	}

	/**
	 * Gets a DOM property from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Property name.
	 * @returns The current or stored property value.
	 */
	getNodeProperty(nodeId: string, name: string): unknown {
		return this.getNodePropertyValue(this.getElementNode(nodeId), name);
	}

	/**
	 * Sets an inline style value on the root element.
	 * @param name Style property name.
	 * @param value Style value.
	 * @returns The current instance.
	 */
	setStyle(name: string, value: string | number): this {
		return this.setNodeStyleValue(this.node, name, value);
	}

	/**
	 * Sets an inline style value on a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Style property name.
	 * @param value Style value.
	 * @returns The current instance.
	 */
	setNodeStyle(nodeId: string, name: string, value: string | number): this {
		return this.setNodeStyleValue(this.getElementNode(nodeId), name, value);
	}

	/**
	 * Gets an inline style value from the root element.
	 * @param name Style property name.
	 * @returns The current or stored style value.
	 */
	getStyle(name: string): string | number | undefined {
		return this.getNodeStyleValue(this.node, name);
	}

	/**
	 * Gets an inline style value from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param name Style property name.
	 * @returns The current or stored style value.
	 */
	getNodeStyle(nodeId: string, name: string): string | number | undefined {
		return this.getNodeStyleValue(this.getElementNode(nodeId), name);
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
		return this.setNodeEventValue(this.node, event, callback);
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
		return this.setNodeEventValue(this.getElementNode(nodeId), event, callback);
	}

	/**
	 * Removes an event handler from a child element node.
	 * @param nodeId `nodeId` of the target element node.
	 * @param event DOM event name.
	 * @returns The current instance.
	 */
	removeNodeEvent(nodeId: string, event: string): this {
		return this.setNodeEventValue(this.getElementNode(nodeId), event);
	}

	private getPreparedNode(id: string): PreparedNode {
		const node = this.idNode[id];
		if (!node) {
			throw new Error("Unknown node id: " + id);
		}
		return node;
	}

	private getElementNode(id: string): PreparedElementNode {
		const node = this.getPreparedNode(id);
		if (!isElementNode(node)) {
			throw new Error("Node must be of type element.");
		}
		return node;
	}

	private renderNode(parent: ParentNode, node: PreparedNode): Node {
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

			const styles = collectInitialStyles(props);
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
						events[key](this.ctx, event);
					};
					el.addEventListener(key, listener);
					node.eventListeners[key] = listener;
				}
			}

			node.el = el;
			parent.appendChild(el);

			for (let i = 0; i < node.children.length; i++) {
				this.renderNode(el, node.children[i]);
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

	private unrenderNode(node: PreparedNode): void {
		if (isElementNode(node)) {
			for (let i = 0; i < node.children.length; i++) {
				this.unrenderNode(node.children[i]);
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

	private addClassToNode(node: PreparedElementNode, className: string): this {
		const classNames = new Set((getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean));
		const normalized = className.trim();
		if (!normalized || classNames.has(normalized)) {
			return this;
		}

		classNames.add(normalized);
		return this.setNodeClassNameValue(node, Array.from(classNames).join(' '));
	}

	private removeClassFromNode(node: PreparedElementNode, className: string): this {
		const classNames = (getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean);
		const normalized = className.trim();
		const filtered = classNames.filter(value => value !== normalized);
		if (filtered.length === classNames.length) {
			return this;
		}

		return this.setNodeClassNameValue(node, filtered.join(' ') || null);
	}

	private hasClassOnNode(node: PreparedElementNode, className: string): boolean {
		const normalized = className.trim();
		return (getClassNameValue(node.model.props) || '').split(/\s+/).filter(Boolean).includes(normalized);
	}

	private setNodeClassNameValue(node: PreparedElementNode, className: string | null): this {
		setClassNameValue(node.model.props, className && className.trim() ? className.trim() : null);
		if (node.el) {
			(node.el as HTMLElement).className = getClassNameValue(node.model.props) || '';
		}
		return this;
	}

	private setNodeAttributeValue(node: PreparedElementNode, name: string, value: unknown): this {
		const attributes = ensureAttributeBucket(node.model.props);
		attributes[name] = value;

		if (node.el) {
			applyAttribute(node.el, name, value);
		}

		return this;
	}

	private removeNodeAttributeValue(node: PreparedElementNode, name: string): this {
		const attributes = getAttributeBucket(node.model.props);
		if (hasOwn(attributes, name)) {
			delete attributes[name];
		}

		if (node.el) {
			node.el.removeAttribute(name);
		}

		return this;
	}

	private setNodePropertyValue(node: PreparedElementNode, name: string, value: unknown): this {
		const properties = ensurePropertyBucket(node.model.props);
		properties[name] = value;

		if (node.el) {
			properties[name] = setElementProperty(node.el, name, value);
		}

		return this;
	}

	private getNodePropertyValue(node: PreparedElementNode, name: string): unknown {
		if (node.el) {
			return getElementProperty(node.el, name);
		}

		return getPropertyValue(node.model.props, name);
	}

	private setNodeStyleValue(node: PreparedElementNode, name: string, value: string | number): this {
		const style = ensureStyleBucket(node.model.props);
		style[name] = value;

		if (node.el) {
			applyStyleValue(node.el as HTMLElement, name, value);
			style[name] = (node.el as HTMLElement).style[name as never] as string;
		}

		return this;
	}

	private getNodeStyleValue(node: PreparedElementNode, name: string): string | number | undefined {
		if (node.el) {
			return (node.el as HTMLElement).style[name as never] as string;
		}

		return getStyleBucket(node.model.props)[name];
	}

	private setNodeEventValue(node: PreparedElementNode, event: string, callback?: ElemEventCallback | null): this {
		const events = ensureEventBucket(node.model.props);
		const currentListener = node.eventListeners[event];
		if (node.el && currentListener) {
			node.el.removeEventListener(event, currentListener);
			delete node.eventListeners[event];
		}

		if (!callback) {
			if (hasOwn(events, event)) {
				delete events[event];
			}
			return this;
		}

		events[event] = callback;
		if (node.el) {
			const listener = (ev: Event) => {
				callback(this.ctx, ev);
			};
			node.el.addEventListener(event, listener);
			node.eventListeners[event] = listener;
		}

		return this;
	}
}

export default Elem;
