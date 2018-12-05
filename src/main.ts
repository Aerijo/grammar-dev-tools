import { CompositeDisposable } from "atom"

import { ScopeView } from "./scope-view"
import { ScopeModel } from "./scope-model"

let subscriptions: CompositeDisposable

export function activate () {
  console.log("Activating grammar-dev-tools...")

  if (!atom.inDevMode()) return

  if (!subscriptions) subscriptions = new CompositeDisposable()

  const model = new ScopeModel()
  const view = new ScopeView(model)

  atom.workspace.open(view, { location: "right" })
}

export function deactivate () {
  console.log("Deactivating grammar-dev-tools...")
  if (subscriptions) subscriptions.dispose()
}
