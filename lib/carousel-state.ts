// Global carousel drag state tracker
// Used to prevent ImageCard from opening modal during carousel swipe

let isDragging = false
let lastDragEndTime = 0

export function setCarouselDragging(dragging: boolean) {
  isDragging = dragging
  if (!dragging) {
    lastDragEndTime = Date.now()
  }
}

export function isCarouselDragging(): boolean {
  // Consider it "dragging" if currently dragging OR if drag ended very recently (within 100ms)
  // This prevents the click event that fires immediately after drag from opening modal
  const timeSinceDragEnd = Date.now() - lastDragEndTime
  return isDragging || timeSinceDragEnd < 100
}
