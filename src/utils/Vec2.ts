class Vec2 {
  constructor(
    public x: number,
    public y: number,
  ) {}

  add(vec: Vec2) {
    return new Vec2(this.x + vec.x, this.y + vec.y);
  }

  sub(vec: Vec2) {
    return new Vec2(this.x - vec.x, this.y - vec.y);
  }

  mul(scalar: number) {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  div(scalar: number) {
    return new Vec2(this.x / scalar, this.y / scalar);
  }

  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  norm() {
    return this.div(this.mag());
  }

  dot(vec: Vec2) {
    return this.x * vec.x + this.y * vec.y;
  }
}

export default Vec2;
