import * as vscode from 'vscode';
const mdast = import('mdast-util-from-markdown');


function textReplacementDecoration(text: string, textDecoration = 'none') {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: 'none; font-size: 0.001em',
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		after: { contentText: text, textDecoration }
	});
}
function fontSizeDecoration(fontSize: string) {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: `none; font-size: ${fontSize}`,
		rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
	});
}

const symbols = [
	'', '_', '●', '○', '◆', '◇', '█',
	'⫸', '⫸⫸', '⫸⫸⫸', '⫸⫸⫸⫸', '⫸⫸⫸⫸⫸', '⫸⫸⫸⫸⫸⫸',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
] as const;


function NodeProcessor() {
	const ranges = Object.fromEntries(
		symbols.map(s => [s, [] as vscode.Range[]])
	);
	function process(node: any, lines: string[]) {
		let { position: { start: s, end: e }, depth, type } = node;
		if (["root"].includes(type)) {
			node.children.forEach((n: any) => process(n, lines));
		}
		else if (type === "list") {
			node.children.forEach((child: any) => {
				child.ordered = node.ordered;
				child.depth = (node.depth || 0) + 1;
			});
			node.children.forEach((n: any) => process(n, lines));
		} else if (type === "listItem") {
			if (lines[s.line - 1].length > node.depth * 2 && !node.ordered) {
				let char = ['●', '○', '◆', '◇'][(node.depth - 1) % 4];
				ranges[char].push(new vscode.Range(
					new vscode.Position(s.line - 1, s.column - 1),
					new vscode.Position(s.line - 1, s.column)
				));
			}
			node.children.forEach((child: any) => {
				if (child.type === "list") {
					child.depth = node.depth;
				}
			});
			node.children.forEach((n: any) => process(n, lines));
		} else if (type === "heading" && depth >= 1 && depth <= 6) {
			if (lines[s.line - 1].length <= depth + 1) { return; }
			ranges['h' + depth].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(e.line - 1, e.column - 1)
			));
			for (let i = 0; i < depth; ++i) {
				ranges['⫸'].push(new vscode.Range(
					new vscode.Position(s.line - 1, i),
					new vscode.Position(s.line - 1, i + 1)
				));
			}
		} else if (type === "thematicBreak") {
			ranges['_'].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(e.line - 1, e.column - 1)
			));
		} else if (type === "blockquote") {
			for (let line = s.line - 1; line < e.line; ++line) {
				ranges['█'].push(new vscode.Range(
					new vscode.Position(line, s.column - 1),
					new vscode.Position(line, s.column)
				));
			}
			node.children.forEach((n: any) => process(n, lines));
		}
	};

	function getRanges() { return ranges; }
	return { process, getRanges };
}

export function activate(context: vscode.ExtensionContext) {
	const editorConfig = vscode.workspace.getConfiguration('editor');
	const lineHeight = editorConfig.get<number>('lineHeight') || 1.5;

	const decorationTypes = {
		'': textReplacementDecoration(''),
		'_': textReplacementDecoration('_'.repeat(80)),
		'█': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; font-size: 0.001em',
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			after: {
				contentText: '█',
				textDecoration: `none; font-size: ${lineHeight}em;`,
				color: 'var(--vscode-editor-foreground)'
			}
		}),
		'●': textReplacementDecoration('●'),
		'○': textReplacementDecoration('○'),
		'◆': textReplacementDecoration('◆'),
		'◇': textReplacementDecoration('◇'),
		'⫸': textReplacementDecoration('⫸', 'none; letter-spacing: -0.25em;'),
		'⫸⫸': textReplacementDecoration('⫸⫸'),
		'⫸⫸⫸': textReplacementDecoration('⫸⫸⫸'),
		'⫸⫸⫸⫸': textReplacementDecoration('⫸⫸⫸⫸'),
		'⫸⫸⫸⫸⫸': textReplacementDecoration('⫸⫸⫸⫸⫸'),
		'⫸⫸⫸⫸⫸⫸': textReplacementDecoration('⫸⫸⫸⫸⫸⫸'),
		'h1': fontSizeDecoration('1.32em'),
		'h2': fontSizeDecoration('1.16em'),
		'h3': fontSizeDecoration('1.08em'),
		'h4': fontSizeDecoration('1.04em'),
		'h5': fontSizeDecoration('1.02em'),
		'h6': fontSizeDecoration('1.01em'),
	};
	Object.values(decorationTypes).forEach(
		decorationType => context.subscriptions.push(decorationType)
	);

	async function decorateEditor(editor: vscode.TextEditor) {
		if (editor.document.languageId === 'markdown') {
			let text = editor.document.getText();
			let { fromMarkdown } = await mdast;
			const tree = fromMarkdown(text);
			const processor = NodeProcessor();
			processor.process(tree, text.split('\n'));
			const ranges = processor.getRanges();
			for (const s of symbols) {
				const decorationType = decorationTypes[s];
				editor.setDecorations(decorationType, ranges[s]);
			}

		}
	}

	// Decorate initial visible editors
	vscode.window.visibleTextEditors.forEach(decorateEditor);

	// Decorate when visible editors change
	context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
		editors.forEach(decorateEditor);
	}));

	// Decorate only when Markdown file content changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.languageId === 'markdown') {
				const editor = vscode.window.visibleTextEditors.find(
					e => e.document === event.document
				);
				if (editor) {
					decorateEditor(editor);
				}
			}
		})
	);
}

export function deactivate() { }