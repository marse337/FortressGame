export function createMapper(view) {
  let lastMap = { scale: 1, ox: 0, oy: 0 };

  function setMap(map) {
    lastMap = map || lastMap;
  }

  function clientToInternal(clientX, clientY) {
    const r = view.getBoundingClientRect();
    const vx = ((clientX - r.left) * (view.width / r.width));
    const vy = ((clientY - r.top) * (view.height / r.height));
    const { scale, ox, oy } = lastMap;
    return { ix: (vx - ox) / scale, iy: (vy - oy) / scale };
  }

  return { setMap, clientToInternal };
}
