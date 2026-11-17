// The retained JavaScript implementation is typed only at the workspace boundary.
declare module '*web/src/player-bridge.js' {
  export function createPlayerBridge(options: unknown): unknown;
}
declare module '*web/index.html?raw' {
  const markup: string;
  export default markup;
}
