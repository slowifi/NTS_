function overlapsTooMuch(a, b, maxOverlap) {
  const depthX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const depthY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return depthX > maxOverlap && depthY > maxOverlap;
}

export function layoutCards(sizes, {
  containerWidth,
  minHeight = 0,
  maxOverlap = 10,
  pinnedIndex = -1,
  random = Math.random,
  attempts = 100,
} = {}) {
  const positions = new Array(sizes.length);
  const placed = [];
  let bottom = 0;

  function place(index, x, y) {
    positions[index] = { x, y };
    placed.push({ x, y, ...sizes[index] });
    bottom = Math.max(bottom, y + sizes[index].height);
  }

  if (pinnedIndex >= 0) {
    const { width } = sizes[pinnedIndex];
    place(pinnedIndex, Math.max(Math.floor((containerWidth - width) / 2), 0), 0);
  }

  sizes.forEach(({ width, height }, index) => {
    if (index === pinnedIndex) return;

    const maxX = Math.max(containerWidth - width, 0);
    const maxY = Math.max(Math.max(minHeight, bottom) - height, 0);

    for (let i = 0; i < attempts; i++) {
      const candidate = {
        x: Math.round(random() * maxX),
        y: Math.round(random() * maxY),
        width,
        height,
      };
      if (!placed.some((other) => overlapsTooMuch(candidate, other, maxOverlap))) {
        place(index, candidate.x, candidate.y);
        return;
      }
    }

    // 빈자리를 못 찾으면 모든 카드의 아래쪽에 maxOverlap만큼만 걸치게 놓는다 (항상 유효).
    place(index, Math.round(random() * maxX), Math.max(bottom - maxOverlap, 0));
  });

  return { positions, height: Math.max(minHeight, bottom) };
}
