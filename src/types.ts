import type { Point, Position } from 'unist';

export interface MdastNode {
    type: string;
    position: Position;
    children?: MdastNode[];
    value?: string;
    depth?: number;
    ordered?: boolean;
    start?: number | null;
    spread?: boolean;
    checked?: boolean | null;
    lang?: string | null;
    meta?: string | null;
    url?: string;
    title?: string | null;
    alt?: string;
    identifier?: string;
    label?: string;
    referenceType?: string;
}

export interface Root extends MdastNode {
    type: 'root';
    children: MdastNode[];
}

export interface Heading extends MdastNode {
    type: 'heading';
    depth: 1 | 2 | 3 | 4 | 5 | 6;
    children: MdastNode[];
}

export interface Text extends MdastNode {
    type: 'text';
    value: string;
}

export interface ThematicBreak extends MdastNode {
    type: 'thematicBreak';
}

export interface Paragraph extends MdastNode {
    type: 'paragraph';
    children: MdastNode[];
}

export interface Strong extends MdastNode {
    type: 'strong';
    children: MdastNode[];
}

export interface Emphasis extends MdastNode {
    type: 'emphasis';
    children: MdastNode[];
}

export interface Delete extends MdastNode {
    type: 'delete';
    children: MdastNode[];
}

export interface Blockquote extends MdastNode {
    type: 'blockquote';
    children: MdastNode[];
}

export interface List extends MdastNode {
    type: 'list';
    ordered: boolean;
    start: number | null;
    spread: boolean;
    children: ListItem[];
}

export interface ListItem extends MdastNode {
    type: 'listItem';
    spread: boolean;
    checked: boolean | null;
    children: MdastNode[];
}

export interface InlineCode extends MdastNode {
    type: 'inlineCode';
    value: string;
}

export interface Code extends MdastNode {
    type: 'code';
    lang: string | null;
    meta: string | null;
    value: string;
}

export interface Link extends MdastNode {
    type: 'link';
    url: string;
    title: string | null;
    children: MdastNode[];
}

export interface Image extends MdastNode {
    type: 'image';
    url: string;
    title: string | null;
    alt: string;
}

export interface ImageReference extends MdastNode {
    type: 'imageReference';
    alt: string;
    identifier: string;
    label: string;
    referenceType: string;
}

export interface Definition extends MdastNode {
    type: 'definition';
    identifier: string;
    label: string;
    url: string;
    title: string | null;
}

export interface FootnoteReference extends MdastNode {
    type: 'footnoteReference';
    identifier: string;
    label: string;
}

export interface FootnoteDefinition extends MdastNode {
    type: 'footnoteDefinition';
    identifier: string;
    label: string;
    children: MdastNode[];
}

export interface Table extends MdastNode {
    type: 'table';
    align: string[],
    children: TableRow[];
}

export interface TableRow extends MdastNode {
    type: 'tableRow';
    children: TableCell[];
}

export interface TableCell extends MdastNode {
    type: 'tableCell';
    children: MdastNode[];
}

export type MdastContent =
    | Root
    | Heading
    | Text
    | ThematicBreak
    | Paragraph
    | Strong
    | Emphasis
    | Delete
    | Blockquote
    | List
    | ListItem
    | InlineCode
    | Code
    | Link
    | Image
    | ImageReference
    | Definition
    | FootnoteReference
    | FootnoteDefinition
    | Table
    | TableRow
    | TableCell;