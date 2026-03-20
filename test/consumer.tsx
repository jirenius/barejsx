import { Elem, type Component } from 'barejsx';

class CustomComponent implements Component {
	render(_el: ParentNode): void {}

	unrender(): void {}

	static fromJSX(props: { label?: string }): Component {
		return new CustomComponent(props.label || '');
	}

	constructor(public readonly label: string = '') {}
}

const node = <div className="example">Hello <span>world</span></div>;
const elem = <Elem as="main">{node}<CustomComponent label="nested" /></Elem>;
const rawElem = new Elem({ type: 'div', props: { className: 'direct' } });
const custom = <CustomComponent label="ok" />;

void elem;
void rawElem;
void custom;
