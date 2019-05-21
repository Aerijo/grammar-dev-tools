import { CompositeDisposable } from "atom"

import { ScopeView } from "./scope-view"
import { ScopeModel } from "./scope-model"

let subscriptions: CompositeDisposable

export function activate () {
  if (!atom.inDevMode() && atom.config.get("grammar-dev-tools.onlyInDevMode")) return

  subscriptions = new CompositeDisposable()

  const model = new ScopeModel()
  const view = new ScopeView(model)

  subscriptions.add(model, view)

  atom.workspace.open(view, { location: "right" })
}

export function deactivate () {
  if (subscriptions) subscriptions.dispose()
}
