import * as etch from "etch"
import { CompositeDisposable, ViewModel, TextEditor, Range } from "atom"

import { ScopeModel, GRAMMAR_TYPE } from "./scope-model"

const $ = etch.dom

export class ScopeView implements ViewModel {

  editors: Set<TextEditor>
  model: ScopeModel
  options: any
  subscriptions: CompositeDisposable

  constructor (model: ScopeModel, options?: any) {
    this.editors = new Set()
    this.model = model
    this.options = options
    this.subscriptions = new CompositeDisposable()

    this.subscribeToEvents()

    etch.initialize(this)
  }

  getTitle (): string {
    return "Grammar properties"
  }

  render () {
    if (this.model.grammarType === GRAMMAR_TYPE.TEXTMATE) {
      return this.renderTextMate()
    } else {
      return this.renderTreeSitter()
    }
  }

  renderTextMate () {
    return (
      $.div({ className: "grammar-view", width: "500px" },
        $.ul({},
          $.li({}, "Type: TextMate"),
          $.li({}, `Name: ${this.model.rootLanguage}`),
          $.li({}, "Scopes:",
            $.ul({}, this.model.scopes.map(s => $.li({}, s)))
          ),
          $.li({}, "Text:",
            $.ul({},
              $.li({}, `All [${getRangeString(this.model.scopeRange)}] >>`, $.br(), this.model.text),
              $.li({}, `Imm [${getRangeString(this.model.immediateRange)}] >>`, $.br(), this.model.textImmediate)
            )
          ),
          $.li({}, `maxTokensPerLine: ${this.model.maxTokensPerLine}`),
          $.li({}, `maxLineLength: ${this.model.maxLineLength}`)
        )
      )
    )
  }

  renderTreeSitter () {
    return (
      $.div({ className: "grammar-view", width: "500px"},
        $.ul({},
          $.li({}, "Tree-sitter to be added"),
          $.li({}, "Path:",
            $.ul({}, this.model.path.map(n => $.li({}, n)))
          )
        )
      )
    )
  }

  update (): Promise<any> {
    return etch.update(this)
  }

  async destroy (): Promise<void> {
    await etch.destroy(this)
  }

  subscribeToEvents (): void {
    this.subscriptions.add(
      atom.workspace.observeTextEditors(editor => {
        this.subscriptions.add(
          editor.observeCursors(cursor => {
            this.subscriptions.add(cursor.onDidChangePosition(event => {
              const newPosition = event.newBufferPosition
              this.model.update(editor, newPosition)
              this.update()
            }))
          }),
          editor.onDidChange(() => {
            this.updateWithEditor(editor)
          }),
          editor.onDidChangeGrammar(() => {
            this.updateWithEditor(editor)
          })
        )
      }),
      atom.workspace.onDidChangeActiveTextEditor(editor => {
        if (editor === undefined) return
        this.updateWithEditor(editor)
      })
    )
  }

  updateWithEditor (editor: TextEditor): void {
    const cursorPosition = editor.getCursorBufferPosition()
    this.model.update(editor, cursorPosition)
    this.update()
  }
}

function getRangeString (range: Range): string {
  return `${range.start.row}:${range.start.column}--${range.end.row}:${range.end.column}`
}
