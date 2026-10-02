export class SpatialHash {
  constructor(worldSize = 1000.0, cellSize = 40.0) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.gridWidth = Math.ceil(worldSize / cellSize);
    this.cellCount = this.gridWidth * this.gridWidth;
    
    // Buckets array: each bucket contains an array of organism IDs/references
    this.buckets = Array.from({ length: this.cellCount }, () => []);
  }

  clear() {
    for (let i = 0; i < this.cellCount; i++) {
      this.buckets[i].length = 0;
    }
  }

  hash(x, y) {
    const gx = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x / this.cellSize)));
    const gy = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(y / this.cellSize)));
    return gy * this.gridWidth + gx;
  }

  insert(entity) {
    const idx = this.hash(entity.x, entity.y);
    this.buckets[idx].push(entity);
  }

  // Query nearby entities within a given radius in bounded Euclidean chamber
  query(x, y, radius, outResults = []) {
    outResults.length = 0;
    const r2 = radius * radius;
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const baseGx = Math.floor(x / this.cellSize);
    const baseGy = Math.floor(y / this.cellSize);
    const W = this.gridWidth;

    const minGy = Math.max(0, baseGy - cellRadius);
    const maxGy = Math.min(W - 1, baseGy + cellRadius);
    const minGx = Math.max(0, baseGx - cellRadius);
    const maxGx = Math.min(W - 1, baseGx + cellRadius);

    for (let gy = minGy; gy <= maxGy; gy++) {
      const row = gy * W;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const bucket = this.buckets[row + gx];
        for (let i = 0; i < bucket.length; i++) {
          const other = bucket[i];
          const diffX = x - other.x;
          const diffY = y - other.y;
          if (diffX * diffX + diffY * diffY <= r2) {
            outResults.push(other);
          }
        }
      }
    }
    return outResults;
  }
}
