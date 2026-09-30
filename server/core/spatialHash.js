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
    let gx = Math.floor(x / this.cellSize) % this.gridWidth;
    let gy = Math.floor(y / this.cellSize) % this.gridWidth;
    if (gx < 0) gx += this.gridWidth;
    if (gy < 0) gy += this.gridWidth;
    return gy * this.gridWidth + gx;
  }

  insert(entity) {
    const idx = this.hash(entity.x, entity.y);
    this.buckets[idx].push(entity);
  }

  // Query nearby entities within a given radius with periodic wrapping
  query(x, y, radius, outResults = []) {
    outResults.length = 0;
    const r2 = radius * radius;
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const baseGx = Math.floor(x / this.cellSize);
    const baseGy = Math.floor(y / this.cellSize);
    const W = this.gridWidth;
    const WS = this.worldSize;

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      let gy = (baseGy + dy) % W;
      if (gy < 0) gy += W;
      const row = gy * W;

      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        let gx = (baseGx + dx) % W;
        if (gx < 0) gx += W;
        const bucket = this.buckets[row + gx];

        for (let i = 0; i < bucket.length; i++) {
          const other = bucket[i];
          // Toroidal shortest distance
          let diffX = Math.abs(x - other.x);
          if (diffX > WS * 0.5) diffX = WS - diffX;
          let diffY = Math.abs(y - other.y);
          if (diffY > WS * 0.5) diffY = WS - diffY;

          if (diffX * diffX + diffY * diffY <= r2) {
            outResults.push(other);
          }
        }
      }
    }
    return outResults;
  }
}
