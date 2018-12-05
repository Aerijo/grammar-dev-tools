import * as etch from "etch"
import { CompositeDisposable, ViewModel, TextEditor } from "atom"

import { ScopeModel } from "./scope-model"

const $ = etch.dom

export class ScopeView implements ViewModel {

  editors: Set<TextEditor>
  model: ScopeModel
  options: any
  subscriptions: CompositeDisposable

  constructor (model: ScopeModel, options?: any) {
    console.log("Constructing view...")

    this.editors = new Set()
    this.model = model
    this.options = options
    this.subscriptions = new CompositeDisposable()

    this.subscribeToEvents()

    etch.initialize(this)

    console.log(this)
  }

  getTitle (): string {
    return "Scope properties at cursor"
  }

  render () {
    return (
      $.div({ className: "grammar-view", width: "500px" },
        $.ul({},
          $.li({}, "Scopes:",
            $.ul({}, this.model.scopes.map(s => $.li({}, s)))
          ),
          $.li({}, "Text:",
            $.ul({},
              $.li({}, `All: ${this.model.text}`),
              $.li({}, `Imm: ${this.model.textImmediate}`)
            )
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
        console.log("Adding", editor)

        this.subscriptions.add(editor.observeCursors(cursor => {
          this.subscriptions.add(cursor.onDidChangePosition(event => {
            const newPosition = event.newBufferPosition

            this.model.update(editor, newPosition)
            this.update()
          }))
        }))
      })
    )
  }
}
