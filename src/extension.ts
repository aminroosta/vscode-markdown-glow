import * as vscode from 'vscode';
const mdast = import('mdast-util-from-markdown');

function buildDecorationType(text: string) {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: 'none; font-size: 0.001em',
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		after: { contentText: text, textDecoration: 'none' }
	});
}
const symbols = ['●', ''];

function NodeProcessor() {
	const ranges = Object.fromEntries(
		symbols.map(s => [s, [] as vscode.Range[]])
	);
	function process(node: any) {
		let { position: { start: s, end: e } } = node;
		if (["list", "root"].includes(node.type)) {
			node.children.forEach(process);
		} else if (node.type === "listItem") {
			const start = new vscode.Position(s.line - 1, s.column - 1);
			const end = new vscode.Position(s.line - 1, s.column);
			const range = new vscode.Range(start, end);
			ranges['●'].push(range);
		}
	};

	function getRanges() { return ranges; }
	return { process, getRanges };
}

export function activate(context: vscode.ExtensionContext) {
	const decorationTypes = Object.fromEntries(
		symbols.map(s => {
			const decoration = buildDecorationType(s);
			context.subscriptions.push(decoration);
			return [s, decoration];
		})
	);

	async function decorateEditor(editor: vscode.TextEditor) {
		if (editor.document.languageId === 'markdown') {
			let text = editor.document.getText();
			let { fromMarkdown } = await mdast;
			const tree = fromMarkdown(text);
			const processor = NodeProcessor();
			processor.process(tree);
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