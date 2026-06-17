export interface Camera {
  x: number; // world cell x at viewport centre
  y: number; // world cell y at viewport centre
  zoom: number; // screen pixels per cell
}

export function createCamera(x: number, y: number, zoom: number): Camera {
  return { x, y, zoom };
}

export function screenToWorld(cam: Camera, sx: number, sy: number, vw: number, vh: number): { wx: number; wy: number } {
  return {
    wx: cam.x + (sx - vw / 2) / cam.zoom,
    wy: cam.y + (sy - vh / 2) / cam.zoom,
  };
}

export function worldToScreen(cam: Camera, wx: number, wy: number, vw: number, vh: number): { sx: number; sy: number } {
  return {
    sx: (wx - cam.x) * cam.zoom + vw / 2,
    sy: (wy - cam.y) * cam.zoom + vh / 2,
  };
}

export function panCamera(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { x: cam.x - dxScreen / cam.zoom, y: cam.y - dyScreen / cam.zoom, zoom: cam.zoom };
}

export function zoomCameraAt(cam: Camera, factor: number, sx: number, sy: number, vw: number, vh: number): Camera {
  const before = screenToWorld(cam, sx, sy, vw, vh);
  const zoom = cam.zoom * factor;
  // keep `before` under the cursor: solve screenToWorld(newCam, sx, sy) == before
  return {
    x: before.wx - (sx - vw / 2) / zoom,
    y: before.wy - (sy - vh / 2) / zoom,
    zoom,
  };
}

export function clampCamera(cam: Camera, worldW: number, worldH: number, minZoom: number, maxZoom: number): Camera {
  const zoom = Math.min(maxZoom, Math.max(minZoom, cam.zoom));
  const x = Math.min(worldW, Math.max(0, cam.x));
  const y = Math.min(worldH, Math.max(0, cam.y));
  return { x, y, zoom };
}
