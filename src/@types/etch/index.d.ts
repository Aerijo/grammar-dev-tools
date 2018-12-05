declare module "etch" {
  export const dom: any
  export function render (virtualNode: VirtualNode, options?: RenderOptions): any
  export function initialize (component: any): void
  export function update (component: any, replaceNode?: boolean): Promise<any>
  export function updateSync (component: any, replaceNode?: boolean): any
  export function destroy (component: any, removeNode?: boolean): Promise<any>
  export function destroySync (component: any, removeNode?: boolean): void
  export function setScheduler (customScheduler: any): void
  export function getScheduler (): any

}

interface VirtualNode {
  text: string | null
  tag: any
  children: any
  props: any
  context: any
}

interface RenderOptions {
  refs: any
  listenerContext: any
}

interface DomResult {
  tag: any
  props: any
  children: any
  ambiguous: any
}
