import { createJsxValue, Fragment } from './internal';
import type { Component, JsxChild, JsxComponentType, JsxExpression } from './types';

function jsx(
	type: string | JsxComponentType<any> | typeof Fragment,
	props?: Record<string, unknown>,
): JsxExpression {
	return createJsxValue(type, props);
}

const jsxs: typeof jsx = jsx;

export { Fragment, jsx, jsxs };

export namespace JSX {
	export type Element = JsxExpression;
	export type ElementType = keyof IntrinsicElements | JsxComponentType<any>;
	export type LibraryManagedAttributes<C, P> = C extends JsxComponentType<infer Props> ? Props : P;
	export interface ElementChildrenAttribute {
		children: {};
	}
	export interface IntrinsicAttributes {
		key?: string | number;
	}
	export interface IntrinsicElements {
		[elementName: string]: {
			[key: string]: unknown;
			class?: string;
			children?: JsxChild;
			nodeId?: string;
		};
	}
	export interface ElementClass extends Component {}
}
