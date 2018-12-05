import { Point, TextEditor, Range } from "atom"

// TODO: Make settings
const MAX_TEXT_PREVIEW_LENGTH = 100
const ADJUST_END_OF_LINE_SCOPE = true
const REPLACE_SPACES = true
const SPACE_CHAR = "\u2423"

export const enum GRAMMAR_TYPE {
  TEXTMATE,
  TREESITTER
}

export class ScopeModel {

  grammarType: GRAMMAR_TYPE

  rootLanguage: string

  scopes: ReadonlyArray<string>
  text: string
  textImmediate: string
  scopeRange: Range
  immediateRange: Range

  constructor () {
    this.grammarType = GRAMMAR_TYPE.TEXTMATE
    this.rootLanguage = ""
    this.scopes = []
    this.text = ""
    this.textImmediate = ""
    this.scopeRange = new Range()
    this.immediateRange = new Range()
  }

  update (editor: TextEditor, position: Point): void {
    this.rootLanguage = editor.getGrammar().name
    if (isTreeSitter(editor)) {
      this.grammarType = GRAMMAR_TYPE.TREESITTER
      this.getTreeSitterBufferRangesForScopeAtPosition(editor, position)
    } else {
      this.grammarType = GRAMMAR_TYPE.TEXTMATE
      this.getTextMateBufferRangesForScopeAtPosition(editor, position)
    }

    this.setTexts(editor)
  }

  getTextMateBufferRangesForScopeAtPosition (editor: any, position: Point): void {
    const lm = editor.languageMode

    const tokenizedLine = lm.tokenizedLineForRow(position.row)
    const tags: number[] = tokenizedLine.tags
    const scopes: number[] = tokenizedLine.openScopes.slice()

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
          debugger
        } else {
          break
        }
      }
    }

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
  }

  setTexts (editor: TextEditor): void {
    console.log("Setting text for", editor, MAX_TEXT_PREVIEW_LENGTH)

    let text = editor.getTextInBufferRange(this.scopeRange)
    if (text.length > MAX_TEXT_PREVIEW_LENGTH) {
      text = `${text.slice(0, 5)}...${text.slice(-5)}`
    }

    if (REPLACE_SPACES) {
      text = text.replace(/\s/g, SPACE_CHAR)
    }

    this.text = text

    text = editor.getTextInBufferRange(this.immediateRange)
    if (text.length > MAX_TEXT_PREVIEW_LENGTH) {
      text = `${text.slice(0, 5)}...${text.slice(-5)}`
    }

    if (REPLACE_SPACES) {
      text = text.replace(/\s/g, SPACE_CHAR)
    }
    this.textImmediate = text

  }

  getTreeSitterBufferRangesForScopeAtPosition (editor: any, position: Point): void {
    console.log(editor, position)

    this.scopes = editor.languageMode.scopeDescriptorForPosition(position).getScopesArray()
    this.scopeRange = new Range([0,0],[0,0])
    this.immediateRange = new Range([0,0],[0,0])
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
