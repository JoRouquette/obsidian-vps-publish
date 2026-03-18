import {
  insertNoPublishingMarker,
  type MarkerInsertionEditor,
} from '../lib/utils/insert-no-publishing-marker.util';

describe('insertNoPublishingMarker', () => {
  function createEditor(lines: string[], cursor: { line: number; ch: number }) {
    const state = {
      lines: [...lines],
      cursor: { ...cursor },
    };

    const editor: MarkerInsertionEditor = {
      getCursor: () => ({ ...state.cursor }),
      getLine: (line: number) => state.lines[line] ?? '',
      lineCount: () => state.lines.length,
      replaceRange: (text, from, to) => {
        const end = to ?? from;
        const before = state.lines[from.line].slice(0, from.ch);
        const after = state.lines[end.line].slice(end.ch);
        const inserted = `${before}${text}${after}`.split('\n');
        state.lines.splice(from.line, end.line - from.line + 1, ...inserted);
      },
      setCursor: (pos) => {
        state.cursor = { ...pos };
      },
    };

    return { editor, state };
  }

  it('replaces an empty line with a standalone marker', () => {
    const { editor, state } = createEditor(['Before', '', 'After'], { line: 1, ch: 0 });

    insertNoPublishingMarker(editor);

    expect(state.lines).toEqual(['Before', '^no-publishing', 'After']);
    expect(state.cursor).toEqual({ line: 1, ch: '^no-publishing'.length });
  });

  it('replaces a whitespace-only line with a standalone marker', () => {
    const { editor, state } = createEditor(['Before', '   ', 'After'], { line: 1, ch: 2 });

    insertNoPublishingMarker(editor);

    expect(state.lines).toEqual(['Before', '^no-publishing', 'After']);
  });

  it('inserts the marker on its own line after a non-empty line', () => {
    const { editor, state } = createEditor(['Before', 'Current line', 'After'], { line: 1, ch: 4 });

    insertNoPublishingMarker(editor);

    expect(state.lines).toEqual(['Before', 'Current line', '^no-publishing', 'After']);
    expect(state.cursor).toEqual({ line: 2, ch: '^no-publishing'.length });
  });

  it('does not add an extra blank line at end of file', () => {
    const { editor, state } = createEditor(['Current line'], { line: 0, ch: 3 });

    insertNoPublishingMarker(editor);

    expect(state.lines).toEqual(['Current line', '^no-publishing']);
  });
});
