import * as vscode from 'vscode';
import emoji from './emoji';
import { MdastNode, Root, Heading, Text, ThematicBreak, Blockquote, Code, Link, Strong, Emphasis, Delete, FootnoteDefinition, FootnoteReference, Table, TableCell, Image, List, ListItem, TableRow } from './types';

// Dynamic imports for Markdown utilities
let fromMarkdown: any;
let gfmFromMarkdown: any;
let gfm: any;

async function initializeMarkdownUtils() {
	const mdast_util_from_markdown = await import('mdast-util-from-markdown');
	const mdast_util_gfm = await import('mdast-util-gfm');
	const micromark_extension_gfm = await import('micromark-extension-gfm');
	fromMarkdown = mdast_util_from_markdown.fromMarkdown;
	gfmFromMarkdown = mdast_util_gfm.gfmFromMarkdown;
	gfm = micromark_extension_gfm.gfm;
}

const aliases = emoji.flatMap(e => e.aliases).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const regex = new RegExp(':(' + aliases.join('|') + '):', 'g');

const lookup: { [key: string]: string } = {};
emoji.forEach(e => {
	e.aliases.forEach(a => {
		lookup[a] = e.emoji;
	});
});

function textReplacementDecoration(text: string, textDecoration = 'none'): vscode.TextEditorDecorationType {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: 'none; font-size: 0.0em',
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		after: { contentText: text, textDecoration }
	});
}

function fontSizeDecoration(fontSize: string): vscode.TextEditorDecorationType {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: `none; font-size: ${fontSize}`,
		rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
	});
}

function fullHeightDecoration(text: string, lineHeight: number, { compact = false, percentage = 30, extra = '' } = {}): vscode.TextEditorDecorationType {
	return vscode.window.createTextEditorDecorationType({
		textDecoration: 'none; font-size: 0.0em',
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		after: {
			contentText: text,
			textDecoration: `none; font-size: ${lineHeight}em${compact ? '; letter-spacing: -0.2em' : ''}`,
			color: `color-mix(in srgb, var(--vscode-editor-background) ${100 - percentage}%, var(--vscode-editor-foreground) ${percentage}%);`,
		}
	});
}

class MarkdownDecorator {
	private ranges: { [key: string]: vscode.Range[] } = {};

	constructor(decorationTypes: Record<string, vscode.TextEditorDecorationType>) {
		Object.keys(decorationTypes).forEach(s => this.ranges[s] = []);
	}

	process(node: MdastNode, lines: string[]): void {
		switch (node.type) {
			case 'list':
				this.processList(node as List, lines);
				break;
			case 'listItem':
				this.processListItem(node as ListItem, lines);
				break;
			case 'heading':
				this.processHeading(node as Heading, lines);
				break;
			case 'thematicBreak':
				this.processThematicBreak(node as ThematicBreak, lines);
				break;
			case 'blockquote':
				this.processBlockquote(node as Blockquote, lines);
				break;
			case 'code':
				this.processCode(node as Code, lines);
				break;
			case 'link':
				this.processLink(node as Link, lines);
				break;
			case 'text':
				this.processText(node as Text, lines);
				break;
			case 'strong':
			case 'delete':
				this.hideMarkup(node as Strong | Delete, 2, 2);
				break;
			case 'emphasis':
			case 'inlineCode':
				this.hideMarkup(node as Emphasis, 1, 1);
				break;
			case 'footnoteDefinition':
				this.processFootnoteDefinition(node as FootnoteDefinition, lines);
				break;
			case 'footnoteReference':
				this.processFootnoteReference(node as FootnoteReference, lines);
				break;
			case 'table':
				// this.processTable(node as Table, lines);
				break;
			case 'image':
				this.processImage(node as Image, lines);
				break;
			default:
				break;
		}
		if (node.children) {
			node.children.forEach((child: MdastNode) => this.process(child, lines));
		}
	}

	private processList(node: List, lines: string[]): void {
		node.children.forEach((child: ListItem) => {
			child.ordered = node.ordered;
			child.depth = Number.isInteger(node.depth) ? node.depth! + 1 : 0;
		});
	}

	private processListItem(node: ListItem, lines: string[]): void {
		const { start: s } = node.position;
		const depth = node.depth ?? 0;
		if (lines[s.line - 1].length > depth * 2 && !node.ordered) {
			const char = ['●', '○', '◆', '◇'][depth % 4];
			this.ranges[char].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(s.line - 1, s.column)
			));
		}
		node.children.forEach((child: MdastNode) => {
			if (child.type === "list") {
				child.depth = node.depth;
			}
		});
	}

	private processHeading(node: Heading, lines: string[]): void {
		const { start: s, end: e } = node.position;
		if (node.depth >= 1 && node.depth <= 6) {
			this.ranges['h' + node.depth].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(e.line - 1, e.column - 1)
			));
			for (let i = 0; i < node.depth; ++i) {
				this.ranges['⫸'].push(new vscode.Range(
					new vscode.Position(s.line - 1, i),
					new vscode.Position(s.line - 1, i + 1)
				));
			}
		}
	}

	private processThematicBreak(node: ThematicBreak, lines: string[]): void {
		const { start: s, end: e } = node.position;
		this.ranges['_'].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column - 1),
			new vscode.Position(e.line - 1, e.column - 1)
		));
	}

	private processBlockquote(node: Blockquote, lines: string[]): void {
		const { start: s, end: e } = node.position;
		if (s.column === 1) {
			for (let line = s.line - 1; line < e.line; ++line) {
				let text = lines[line];
				const sub_idx = text.search(/[^>\s]/);
				if (sub_idx !== -1) {
					text = text.substring(0, sub_idx);
				}
				const last = text.lastIndexOf(">");
				for (let column = s.column - 1; column <= last; ++column) {
					this.ranges['█'].push(new vscode.Range(
						new vscode.Position(line, column),
						new vscode.Position(line, column + 1)
					));
				}
			}
		}
	}

	private processCode(node: Code, lines: string[]): void {
		const { start: s, end: e } = node.position;
		this.ranges['code'].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column - 1),
			new vscode.Position(e.line - 1, e.column - 1)
		));
		if (lines[s.line - 1].startsWith('```')) {
			this.ranges['fade'].push(new vscode.Range(
				new vscode.Position(s.line - 1, 0),
				new vscode.Position(s.line - 1, 3)
			));
		}
		if (lines[e.line - 1].startsWith('```')) {
			this.ranges['fade'].push(new vscode.Range(
				new vscode.Position(e.line - 1, 0),
				new vscode.Position(e.line - 1, 3)
			));
		}
	}

	private processLink(node: Link, lines: string[]): void {
		if (node.children.length === 1 && node.children[0].type === "text") {
			const { start: ps, end: pe } = node.children[0].position;
			const { start: s, end: e } = node.position;
			this.ranges[''].push(new vscode.Range(
				new vscode.Position(s.line - 1, s.column - 1),
				new vscode.Position(ps.line - 1, ps.column - 1)
			));
			this.ranges[''].push(new vscode.Range(
				new vscode.Position(pe.line - 1, pe.column - 1),
				new vscode.Position(e.line - 1, e.column - 1)
			));
		}
	}

	private processText(node: Text, lines: string[]): void {
		const { start: s } = node.position;
		const { value } = node;
		if (value) {
			value.split('\n').forEach((_: any, idx: number) => {
				const line = lines[s.line - 1 + idx];
				const result = Array.from(line.matchAll(regex)) as any;
				for (const m of result) {
					const range = new vscode.Range(
						new vscode.Position(s.line - 1 + idx, m.index),
						new vscode.Position(s.line - 1 + idx, m.index + m[0].length)
					);
					this.ranges[lookup[m[1]]].push(range);
				}
			});
		}
	}

	private hideMarkup(node: Strong | Emphasis | Delete, startOffset: number, endOffset: number): void {
		const { start: s, end: e } = node.position;
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column - 1),
			new vscode.Position(s.line - 1, s.column - 1 + startOffset)
		));
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(e.line - 1, e.column - 1 - endOffset),
			new vscode.Position(e.line - 1, e.column - 1)
		));
	}

	private processFootnoteDefinition(node: FootnoteDefinition, lines: string[]): void {
		const { start: s } = node.position;
		const line = lines[s.line - 1];
		const start = line.indexOf("[^");
		const end = line.indexOf("]");
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(s.line - 1, start),
			new vscode.Position(s.line - 1, start + 2)
		));
		this.ranges['↩'].push(new vscode.Range(
			new vscode.Position(s.line - 1, end),
			new vscode.Position(s.line - 1, end + 1)
		));
	}

	private processFootnoteReference(node: FootnoteReference, lines: string[]): void {
		const { start: s, end: e } = node.position;
		this.ranges['↪'].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column - 1),
			new vscode.Position(s.line - 1, s.column + 1)
		));
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(s.line - 1, e.column - 2),
			new vscode.Position(s.line - 1, e.column - 1)
		));
	}

	private processTableRow(node: TableRow, lines: string[], columnsInfo: { align: string | null, maxWidth: number }[]) {
		const { start, end } = node.position;
		let line = lines[start.line - 1];
		let ecolumn = start.column - 1;
		this.ranges['│'].push(new vscode.Range(
			new vscode.Position(start.line - 1, ecolumn),
			new vscode.Position(start.line - 1, ecolumn)
		));
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(start.line - 1, ecolumn),
			new vscode.Position(start.line - 1, ecolumn + 1)
		));

		for (let i = 0; i < node.children.length; ++i) {
			let cell = node.children[i];
			let info = columnsInfo[i];
			const { start: s, end: e } = cell.position;
			let width = this.getTableCellWidth(cell);

			ecolumn = Math.min(line.length - 1, e.column - 1);
			if (width < info.maxWidth) {
				let diff = info.maxWidth - width;
				let key = `pad_${diff}`;
				this.ranges[key].push(new vscode.Range(
					new vscode.Position(s.line - 1, ecolumn),
					new vscode.Position(s.line - 1, ecolumn)
				));
			}
			this.ranges['│'].push(new vscode.Range(
				new vscode.Position(start.line - 1, ecolumn),
				new vscode.Position(start.line - 1, ecolumn + 1)
			));
		}
	}

	private processTable(node: Table, lines: string[]): void {
		const columnsInfo = this.getTableColumnsInfo(node);
		node.children.forEach((tableRow) => {
			this.processTableRow(tableRow, lines, columnsInfo);
		});

		const { start: s, end: _e } = node.position;
		let column = s.column - 1;
		const parts = lines[s.line].trim().split('|').filter(p => p.length > 0);
		for (let idx = 0; idx < parts.length; ++idx) {
			let part = parts[idx];
			let info = columnsInfo[idx];
			const char = column === (s.column - 1) ? '│' : '┼';
			this.ranges[char].push(new vscode.Range(
				new vscode.Position(s.line, column),
				new vscode.Position(s.line, column + 1)
			));
			column = column + 1;
			let offset = idx === (parts.length - 1) ? -1 : 0;
			let key = `div_${info.maxWidth + offset}`;
			this.ranges[key].push(new vscode.Range(
				new vscode.Position(s.line, column),
				new vscode.Position(s.line, column + part.length)
			));
			column = column + part.length;
		}
		this.ranges['│'].push(new vscode.Range(
			new vscode.Position(s.line, column),
			new vscode.Position(s.line, column + 1)
		));
		column += 1;
	}

	private getTableColumnsInfo(node: Table): { align: string | null, maxWidth: number }[] {
		const columnCount = node.align.length || 0;
		const columnsInfo = Array.from({ length: columnCount }, (_, i) => ({
			align: node.align[i] || 'left',
			maxWidth: 0
		}));

		// Calculate maximum width for each column
		node.children.forEach(row => {
			row.children.forEach((cell, i) => {
				if (i < columnCount) {
					const width = this.getTableCellWidth(cell);
					if (width > columnsInfo[i].maxWidth) {
						columnsInfo[i].maxWidth = width;
					}
				}
			});
		});

		return columnsInfo;
	}

	private getTableCellWidth(node: TableCell) {
		const { start: s, end: e } = node.position;
		let width = e.column - s.column - 1;
		function subtractions(child: any) {
			let total = 0;
			if (child.type === 'strong' || child.type === 'delete') {
				total = 4;
			} else if (child.type === 'emphasis') {
				total = 2;
			}
			let children = child.children || [];
			for (let ch of children) {
				total += subtractions(ch);
			}
			return total;
		}
		width -= subtractions(node);
		return width;
	}

	private processImage(node: Image, lines: string[]): void {
		const { start: s, end: e } = node.position;
		const { alt = '' } = node;
		this.ranges['◧'].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column - 1),
			new vscode.Position(s.line - 1, s.column + 1)
		));
		this.ranges[''].push(new vscode.Range(
			new vscode.Position(s.line - 1, s.column + 1 + alt.length),
			new vscode.Position(e.line - 1, e.column - 1)
		));
	}

	getRanges(): { [key: string]: vscode.Range[] } {
		return this.ranges;
	}
}

function createDecorationTypes(lineHeight: number): { [key: string]: vscode.TextEditorDecorationType } {
	const decorationTypes: { [key: string]: vscode.TextEditorDecorationType } = {
		'': textReplacementDecoration(''),
		' ': textReplacementDecoration(' '),
		'_': vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; border-bottom: 1px solid var(--vscode-editor-foreground); width: 100vw; display: inline-block; position: relative; top: -50%',
			color: 'transparent',
			isWholeLine: true,
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
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
		'█': fullHeightDecoration('█', lineHeight, { compact: true }),
		'▒': fullHeightDecoration('▒', lineHeight),
		'│': fullHeightDecoration('│', lineHeight, { compact: true }),
		'┬': textReplacementDecoration('┬'),
		'┼': fullHeightDecoration('┼', lineHeight, { compact: true }),
		'─': fullHeightDecoration('─', lineHeight, { compact: true }),
		// '─': textReplacementDecoration('─'),
		'├': textReplacementDecoration('├'),
		'┌': textReplacementDecoration('┌'),
		'●': textReplacementDecoration('●'),
		'↩': textReplacementDecoration('↩', 'none; font-weight: bold'),
		'↪': textReplacementDecoration(' ↪', 'none; font-weight: bold'),
		'◧': fullHeightDecoration('◧ ', lineHeight, { percentage: 80 }),
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

	for (let diff = 1; diff < 500; ++diff) {
		let key = `pad_${diff}`;
		decorationTypes[key] = vscode.window.createTextEditorDecorationType({
			textDecoration: 'none; font-size: 0.0em',
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			after: {
				contentText: 'M'.repeat(diff),
				textDecoration: `none; font-size: ${lineHeight}em; letter-spacing: -0.2em`,
				color: 'transparent'
			}
		});
		key = `div_${diff}`;
		decorationTypes[key] = fullHeightDecoration('─'.repeat(diff), lineHeight, { compact: true });
	}

	Object.values(lookup).forEach(emoji => {
		decorationTypes[emoji] = textReplacementDecoration(emoji);
	});
	return decorationTypes;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	await initializeMarkdownUtils();
	const editorConfig = vscode.workspace.getConfiguration('editor');
	const lineHeight = editorConfig.get<number>('lineHeight') || 1.5;
	const decorationTypes = createDecorationTypes(lineHeight);
	Object.values(decorationTypes).forEach(decorationType => context.subscriptions.push(decorationType));

	let cacheStore: { [uri: string]: { version: number, ranges: { [key: string]: vscode.Range[] } } } = {};

	function decorateEditor(editor: vscode.TextEditor): void {
		if (editor.document.languageId === 'markdown') {
			const uri = editor.document.uri.toString();
			let cache = cacheStore[uri];
			let ranges: { [key: string]: vscode.Range[] } = {};
			if (cache && cache.version === editor.document.version) {
				ranges = cache.ranges;
			} else {
				const text = editor.document.getText();
				const tree: Root = fromMarkdown(text, {
					extensions: [gfm()],
					mdastExtensions: [gfmFromMarkdown()]
				});
				const processor = new MarkdownDecorator(decorationTypes);
				processor.process(tree, text.split('\n'));
				ranges = processor.getRanges();
				cacheStore[uri] = { version: editor.document.version, ranges };
			}

			const selection = editor.selection;
			for (const s of Object.keys(ranges)) {
				const decorationType = decorationTypes[s];
				let targetRanges = ranges[s];
				if (s !== 'code') {
					targetRanges = ranges[s].filter(r => r.start.line !== selection.start.line);
				}
				editor.setDecorations(decorationType, targetRanges);
			}
		}
	}

	vscode.window.visibleTextEditors.forEach(decorateEditor);

	context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
		editors.forEach(decorateEditor);
	}));

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

	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(
			(event: vscode.TextEditorSelectionChangeEvent) => {
				if (event.textEditor.document.languageId === 'markdown') {
					decorateEditor(event.textEditor);
				}
			})
	);
}

export function deactivate(): void { }