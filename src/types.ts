export interface Component {
	render(el: ParentNode): void;
	unrender(): void;
}

export interface JsxTextNode {
	text: string;
}

export interface JsxComponentNode {
	component: Component;
	nodeId?: string;
}

export interface JsxElementProps {
	[key: string]: unknown;
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
	children?: JsxChild;
}

export type ElemInput = JsxElementObject;

export type JsxExpression = JsxElementObject | Component;
