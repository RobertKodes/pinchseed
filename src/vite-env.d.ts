/// <reference types="vite/client" />

interface GestureEvent extends Event {
  scale: number
  rotation: number
}

interface HTMLElementEventMap {
  gesturestart: GestureEvent
  gesturechange: GestureEvent
  gestureend: GestureEvent
}
