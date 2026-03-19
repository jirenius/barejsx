import type { Component, ElemInput, ElemProps, JsxElementObject } from './types';

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
	 * @param element Structured JSX element object.
	 */
	public readonly tagName: string;
	public readonly props: JsxElementObject['props'];

	constructor(public readonly element: ElemInput) {
		this.tagName = element.type;
		this.props = element.props;
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

		return new Elem({
			type: tagName,
			props: elementProps as JsxElementObject['props'],
		});
	}

	render(_el: ParentNode): void {
		throw new Error("Elem.render is not implemented yet.");
	}

	unrender(): void {
		throw new Error("Elem.unrender is not implemented yet.");
	}
}

export default Elem;
