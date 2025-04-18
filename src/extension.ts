import * as vscode from 'vscode';
import emoji from './emoji';
import { writeFileSync } from 'node:fs';

// import { fromMarkdown } from 'mdast-util-from-markdown'
const mdast_util_from_markdown = import('mdast-util-from-markdown');
const mdast_util_gfm = import('mdast-util-gfm');
const micromark_extension_gfm = import('micromark-extension-gfm');

const aliases = emoji.flatMap(e => e.aliases).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const regex = new RegExp(':(' + aliases.join('|') + '):', 'g');


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
	'', ' ', '_', '●', '○', '◆', '◇', '█', '▒', '↪', '↩',
	'⫸', '⫸⫸', '⫸⫸⫸', '⫸⫸⫸⫸', '⫸⫸⫸⫸⫸', '⫸⫸⫸⫸⫸⫸',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'code', 'fade',
];
const lookup = {} as any;
emoji.forEach(e => {
	e.aliases.forEach(a => {
		lookup[a] = e.emoji;
	});
});


function NodeProcessor() {
	const ranges = Object.fromEntries(
		symbols.map(s => [s, [] as vscode.Range[]])
	);
	function process(node: any, lines: string[]) {
		let { position: { start: s, end: e }, depth, type, value } = node;
		if (type === "list") {
			node.children.forEach((child: any) => {
				child.ordered = node.ordered;
				child.depth = (node.depth || 0) + 1;
			});
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
		} else if (type === "heading" && depth >= 1 && depth <= 6) {
			// if (lines[s.line - 1].length <= depth + 1) { return; }
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
		} else if (type === "blockquote" && s.column === 1) {
			for (let line = s.line - 1; line < e.line; ++line) {
				let text = lines[line];
				let sub_idx = text.search(/[^>\s]/);
				if (sub_idx !== -1) {
					text = text.substring(0, sub_idx);
				}
				let last = text.lastIndexOf(">");
				for (let column = s.column - 1; column <= last; ++column) {
					ranges['█'].push(new vscode.Range(
						new vscode.Position(line, column),
						new vscode.Position(line, column + 1)
					));
				}
			}
		} else if (type === "code") {
			ranges['code'].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(e.line - 1, e.column - 1)
			));
			if (lines[s.line - 1].startsWith('```')) {
				ranges['fade'].push(new vscode.Range(
					new vscode.Position(s.line - 1, 0),
					new vscode.Position(s.line - 1, 3)
				));
			}
			if (lines[e.line - 1].startsWith('```')) {
				ranges['fade'].push(new vscode.Range(
					new vscode.Position(e.line - 1, 0),
					new vscode.Position(e.line - 1, 3)
				));
			}
		} else if (type === "link") {
			if (node.children.length === 1 && node.children[0].type === "text") {
				let { start: ps, end: pe } = node.children[0].position;
				ranges[''].push(new vscode.Range(
					new vscode.Position(s.line - 1, s.column - 1),
					new vscode.Position(s.line - 1, ps.column - 1)
				));

				ranges[''].push(new vscode.Range(
					new vscode.Position(e.line - 1, pe.column - 1),
					new vscode.Position(e.line - 1, e.column - 1)
				));
			}
		} else if (type === "text") {
			value.split('\n').forEach((_line: string, idx: number) => {
				let line = lines[s.line - 1 + idx];
				let result = Array.from(line.matchAll(regex)) as any;
				for (let m of result) {
					const range = new vscode.Range(
						new vscode.Position(s.line - 1 + idx, m.index),
						new vscode.Position(s.line - 1 + idx, m.index + m[0].length)
					);
					if (!ranges[lookup[m[1]]]) {
						ranges[lookup[m[1]]] = [range];
					} else {
						ranges[lookup[m[1]]].push(range);
					}
				}
			});
		} else if (type === "strong" || type === "delete") {
			ranges[''].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(s.line - 1, s.column + 1)
			));
			ranges[''].push(new vscode.Range(
				new vscode.Position(e.line - 1, e.column - 3),
				new vscode.Position(e.line - 1, e.column - 1)
			));
		} else if (type === "emphasis") {
			ranges[''].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(s.line - 1, s.column)
			));
			ranges[''].push(new vscode.Range(
				new vscode.Position(e.line - 1, e.column - 2),
				new vscode.Position(e.line - 1, e.column - 1)
			));

		} else if (type === "footnoteDefinition") {
			let line = lines[s.line - 1];
			let start = line.indexOf("[^");
			let end = line.indexOf("]");
			ranges[''].push(new vscode.Range(
				new vscode.Position(s.line - 1, start),
				new vscode.Position(s.line - 1, start + 2)
			));
			ranges['↩'].push(new vscode.Range(
				new vscode.Position(s.line - 1, end),
				new vscode.Position(s.line - 1, end + 1)
			));
		} else if (type === "footnoteReference") {
			ranges['↪'].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(s.line - 1, s.column + 1)
			));
			ranges[''].push(new vscode.Range(
				new vscode.Position(s.line - 1, e.column - 2),
				new vscode.Position(s.line - 1, e.column - 1)
			));
		}

		if (node.children) {
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
		' ': textReplacementDecoration(' '),
		// '_': textReplacementDecoration('_'.repeat(80)),
		'_': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; border-bottom: 1px solid var(--vscode-editor-foreground); width: 100vw; display: inline-block; position: relative; top: -50%',
			color: 'transparent',
			isWholeLine: true,
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		}),
		'█': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; font-size: 0.001em',
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			after: {
				contentText: '█',
				textDecoration: `none; font-size: ${lineHeight}em; letter-spacing: -0.2em`,
				color: 'color-mix(in srgb, var(--vscode-editor-background) 70%, var(--vscode-editor-foreground) 30%);',
			}
		}),
		'▒': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; font-size: 0.001em',
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			after: {
				contentText: '▒',
				textDecoration: `none; font-size: ${lineHeight}em`,
				color: 'color-mix(in srgb, var(--vscode-editor-background) 70%, var(--vscode-editor-foreground) 30%);',
			}
		}),
		'code': vscode.window.createTextEditorDecorationType({
			backgroundColor: 'color-mix(in srgb, var(--vscode-editor-background) 90%, var(--vscode-editor-foreground) 5%);',
			isWholeLine: true,
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		}),
		'fade': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; opacity: 0',
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		}),
		'●': textReplacementDecoration('●'),
		'↩': textReplacementDecoration('↩', 'none; font-weight: bold'),
		'↪': textReplacementDecoration(' ↪', 'none; font-weight: bold'),
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
	Object.values(lookup).forEach((emoji: any) => {
		(decorationTypes as any)[emoji] = textReplacementDecoration(emoji);
	});
	Object.values(decorationTypes).forEach(
		decorationType => context.subscriptions.push(decorationType)
	);
	async function decorateEditor(editor: vscode.TextEditor) {
		if (editor.document.languageId === 'markdown') {
			const { fromMarkdown } = await mdast_util_from_markdown;
			const { gfmFromMarkdown, gfmToMarkdown } = await mdast_util_gfm;
			const { gfm } = await micromark_extension_gfm;
			let selection = editor.selection;
			let text = editor.document.getText();

			const tree = fromMarkdown(text, {
				extensions: [gfm()],
				mdastExtensions: [gfmFromMarkdown()]
			});

			const processor = NodeProcessor();
			processor.process(tree, text.split('\n'));
			const ranges = processor.getRanges();
			for (const s of Object.keys(ranges)) {
				const decorationType = (decorationTypes as any)[s];
				let targetRanges = ranges[s];
				if (s !== 'code') {
					targetRanges = ranges[s].filter(r => r.start.line !== selection.start.line);
				}

				editor.setDecorations(decorationType, targetRanges);
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
	// Listen to cursor movements
	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(
			(event: vscode.TextEditorSelectionChangeEvent) => {
				if (event.textEditor.document.languageId === 'markdown') {
					decorateEditor(event.textEditor);
				}
			})
	);


}

export function deactivate() { }