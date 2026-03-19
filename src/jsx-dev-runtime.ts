import { Fragment, jsx } from './jsx-runtime';
import type { Component, JsxChild, JsxComponentType, JsxExpression } from './types';

function jsxDEV(
	type: string | JsxComponentType<any> | typeof Fragment,
	props?: Record<string, unknown>,
): JsxExpression {
	return jsx(type, props);
}

export { Fragment, jsxDEV };

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
			children?: JsxChild;
			nodeId?: string;
		};
	}
	export interface ElementClass extends Component {}
}
