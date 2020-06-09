export class BBox {
  constructor (x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

export function ang2sweep(a) {
  return - a * 180 / Math.PI;
}

export function ang2arc(a) {
  return 90 - a * 180 / Math.PI;
}

// Add zero in front of numbers < 10
export function zeroPad(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}