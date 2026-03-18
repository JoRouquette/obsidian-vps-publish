type EditorPosition = {
  line: number;
  ch: number;
};

export type MarkerInsertionEditor = {
  getCursor(): EditorPosition;
  getLine(line: number): string;
  lineCount(): number;
  replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
  setCursor(pos: EditorPosition): void;
};

const MARKER = '^no-publishing';

export function insertNoPublishingMarker(editor: MarkerInsertionEditor): void {
  const cursor = editor.getCursor();
  const currentLine = editor.getLine(cursor.line) ?? '';

  if (currentLine.trim() === '') {
    editor.replaceRange(
      MARKER,
      { line: cursor.line, ch: 0 },
      { line: cursor.line, ch: currentLine.length }
    );
    editor.setCursor({ line: cursor.line, ch: MARKER.length });
    return;
  }

  editor.replaceRange(`\n${MARKER}`, { line: cursor.line, ch: currentLine.length });
  editor.setCursor({ line: cursor.line + 1, ch: MARKER.length });
}
