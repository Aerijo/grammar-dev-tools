import { Point, TextEditor, Range } from "atom"

// TODO: Make settings
const MAX_TEXT_PREVIEW_LENGTH = 100
const ADJUST_END_OF_LINE_SCOPE = true
const REPLACE_SPACES = true

export const enum GRAMMAR_TYPE {
  TEXTMATE,
  TREESITTER
}

export class ScopeModel {

  grammarType: GRAMMAR_TYPE
  maxTokensPerLine: number | undefined
  maxLineLength: number | undefined

  rootLanguage: string | undefined

  scopes: ReadonlyArray<string>
  text: string
  textImmediate: string
  scopeRange: Range
  immediateRange: Range

  marker: any
  path: ReadonlyArray<string>

  constructor () {
    this.grammarType = GRAMMAR_TYPE.TEXTMATE
    this.scopes = []
    this.path = []
    this.text = ""
    this.textImmediate = ""
    this.scopeRange = new Range([0,0], [0,0])
    this.immediateRange = new Range([0,0], [0,0])
  }

  dispose () {
    if (this.marker) {
      this.marker.destroy()
    }
  }

  update (editor: TextEditor, position: Point): void {
    const grammar: any = editor.getGrammar()
    this.rootLanguage = grammar.name

    if (isTreeSitter(editor)) {
      this.grammarType = GRAMMAR_TYPE.TREESITTER
      this.getTreeSitterBufferRangesForScopeAtPosition(editor, position)
    } else {
      this.grammarType = GRAMMAR_TYPE.TEXTMATE

      this.maxTokensPerLine = grammar.getMaxTokensPerLine()
      this.maxLineLength = grammar.maxLineLength
      this.getTextMateBufferRangesForScopeAtPosition(editor, position)

      // Prevents crashing if the walk screws up
      this.scopeRange = editor.clipBufferRange(this.scopeRange)
      this.immediateRange = editor.clipBufferRange(this.immediateRange)

      if (!this.marker || !this.marker.isValid() || this.marker.isDestroyed()) {
        this.marker = editor.markBufferRange(this.immediateRange)
        editor.decorateMarker(this.marker, { type: "highlight", class: "grammar-range" })
      }

      if (!this.marker.getBufferRange().isEqual(this.immediateRange)) {
        this.marker.setBufferRange(this.immediateRange)
      }

      this.setTexts(editor)
    }
  }

  getTextMateBufferRangesForScopeAtPosition (editor: any, position: Point): void {
    const lm = editor.languageMode

    const tokenizedLine = lm.tokenizedLineForRow(position.row)
    const tags: number[] = tokenizedLine.tags
    const scopes: number[] = tokenizedLine.openScopes.slice()

    // TODO: Handle 0 width matches

    let index = 0
    let tagIndex = 0
    for (; tagIndex < tags.length; tagIndex++) {
      const tag = tags[tagIndex]
      if (tag < 0) {
        (tag % 2) === 0 ? scopes.pop() : scopes.push(tag)
      } else {
        index += tag
        if (index > position.column) {
          break
        }
      }
    }

    if (ADJUST_END_OF_LINE_SCOPE && tagIndex === tags.length) {
      tagIndex -= 1
      for (; tagIndex >= 0; tagIndex--) {
        const tag = tags[tagIndex]
        if (tag < 0 && (tag % 2) === 0) {
          scopes.push(tag + 1)
        } else if (tag < 0 && (tag % 2) !== 0) {
          // TODO: Work out how to handle this. It can happen; see in Markdown
          /*
          ```latex
          \begin{minted}{python}
          ```
           */
          debugger
        } else {
          break
        }
      }
    }

    // TODO: Fix and remove this kludge
    if (tagIndex === tags.length) tagIndex--

    this.scopes = scopes.map(tag => lm.grammar.scopeForId(tag))

    let { row } = position

    this.setRangeStarts(lm, scopes.length, row, index, tags, tagIndex)
    this.setRangeEnds(lm, scopes.length, row, index, tags, tagIndex)
  }

  setRangeStarts (languageMode: any, depth: number, row: number, column: number, tags: number[], tagIndex: number): void {
    let setImmediate = true
    const startDepth = depth

    for (; tagIndex >= 0; tagIndex--) {
      const tag = tags[tagIndex]
      if (tag < 0) {
        if (setImmediate) {
          setImmediate = false
          this.immediateRange.start.row = row
          this.immediateRange.start.column = column
        }
        if ((tag % 2) === 0) {
          depth += 1
        } else {
          depth -= 1
          if (depth < startDepth) {
            this.scopeRange.start.row = row
            this.scopeRange.start.column = column
            return
          }
        }
      } else {
        column -= tag
      }
    }

    row -= 1
    for (; row >= 0; row--) {
      tags = languageMode.tokenizedLineForRow(row).tags
      tagIndex = tags.length - 1
      for (; tagIndex >= 0; tagIndex--) {
        const tag = tags[tagIndex]
        if (tag < 0) {
          if (setImmediate) {
            setImmediate = false
            this.immediateRange.start.row = row
            this.immediateRange.start.column = getColumnFromTagIndex(tags, tagIndex)
          }
          if ((tag % 2) === 0) {
            depth += 1
          } else {
            depth -= 1
            if (depth < startDepth) {
              this.scopeRange.start.row = row
              this.scopeRange.start.column = getColumnFromTagIndex(tags, tagIndex)
              return
            }
          }
        }
      }
    }
  }

  setRangeEnds (languageMode: any, depth: number, row: number, column: number, tags: number[], tagIndex: number): void {
    let setImmediate = true
    const startDepth = depth

    tagIndex += 1

    for (; tagIndex < tags.length; tagIndex++) {
      const tag = tags[tagIndex]
      if (tag < 0) {
        if (setImmediate) {
          setImmediate = false
          this.immediateRange.end.row = row
          this.immediateRange.end.column = column
        }
        if ((tag % 2) === 0) {
          depth -= 1
          if (depth < startDepth) {
            this.scopeRange.end.row = row
            this.scopeRange.end.column = column
            return
          }
        } else {
          depth += 1
        }
      } else {
        column += tag
      }
    }

    const lastRow = languageMode.buffer.getLastRow()
    row += 1
    for (; row <= lastRow; row++) {
      tags = languageMode.tokenizedLineForRow(row).tags
      tagIndex = 0
      column = 0
      for (; tagIndex < tags.length; tagIndex++) {
        const tag = tags[tagIndex]
        if (tag < 0) {
          if (setImmediate) {
            setImmediate = false
            this.immediateRange.end.row = row
            this.immediateRange.end.column = column
          }
          if ((tag % 2) === 0) {
            depth -= 1
            if (depth < startDepth) {
              this.scopeRange.end.row = row
              this.scopeRange.end.column = column
              return
            }
          } else {
            depth += 1
          }
        } else {
          column += tag
        }
      }
    }

    const endPoint = languageMode.buffer.getEndPosition()
    if (setImmediate) {
      this.immediateRange.end = endPoint.copy()
    }
    this.scopeRange.end = endPoint.copy()
  }

  setTexts (editor: TextEditor): void {
    this.text = getTextPreview(editor.getTextInBufferRange(this.scopeRange), editor)
    this.textImmediate = getTextPreview(editor.getTextInBufferRange(this.immediateRange), editor)
  }

  getTreeSitterBufferRangesForScopeAtPosition (editor: any, position: Point): void {
    this.path = editor.syntaxTreeScopeDescriptorForBufferPosition(position).getScopesArray()
  }
}

function isTreeSitter (editor: any): boolean {
  return editor.languageMode.syntaxTreeScopeDescriptorForPosition !== undefined
}

function getColumnFromTagIndex (tags: number[], tagIndex: number): number {
  let column = 0
  for (let i = 0; i <= tagIndex; i++) {
    const tag = tags[i]
    if (tag > 0) column += tag
  }
  return column
}

function getTextPreview (text: string, editor?: any) {
  if (text.length > MAX_TEXT_PREVIEW_LENGTH) {
    text = `${text.slice(0, 5)}...${text.slice(-5)}`
  }

  if (REPLACE_SPACES && editor) {
    const NEWLINE_CHAR: string = editor.invisibles.eol
    const SPACE_CHAR: string = editor.invisibles.space
    const TAB_CHAR: string = editor.invisibles.tab
    text = text.replace(/\s/g, c => {
      switch (c) {
        case " ": return SPACE_CHAR
        case "\n": return NEWLINE_CHAR
        case "\t": return TAB_CHAR
        default: return c
      }
    })
  }

  return text
}
