export interface Component {
	render(el: ParentNode): void;
	unrender(): void;
}

export type ElemEventCallback = (ctx: unknown, event: unknown) => void;

export interface JsxTextNode {
	text: string;
}

export interface JsxComponentNode {
	component: Component;
	nodeId?: string;
}

export interface JsxElementProps {
	[key: string]: unknown;
	className?: string;
	attributes?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	style?: Record<string, string | number>;
	events?: Record<string, ElemEventCallback>;
	children?: JsxNormalizedChild[];
	nodeId?: string;
}

export interface JsxElementObject {
	type: string;
	props: JsxElementProps;
}

export type JsxNormalizedChild = JsxElementObject | JsxTextNode | JsxComponentNode;

export type JsxChild =
	| JsxNormalizedChild
	| Component
	| string
	| number
	| boolean
	| null
	| undefined
	| JsxChild[];

export interface JsxComponentType<Props = any> {
	fromJSX(props: Props): Component;
	name?: string;
}

export interface ElemProps {
	[key: string]: unknown;
	as?: string;
	class?: string;
	children?: JsxChild;
}

export type ElemInput = JsxElementObject;

export type JsxExpression = JsxElementObject | Component;
