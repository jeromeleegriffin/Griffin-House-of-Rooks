(function (root) {
  'use strict';
  const duration = 2750,
    clamp = (x) => Math.max(0, Math.min(1, x)),
    ease = (x) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    },
    mix = (a, b, t) => a + (b - a) * t;
  const beats = [
    [0, 'Ready'],
    [1, 'Awakening'],
    [350, 'Approach'],
    [1120, 'Clash'],
    [1700, 'Black wins'],
    [2350, 'Return'],
    [2750, 'Complete'],
  ];
  function pose(t, side, start, reduced = false, spread = 1) {
    const black = side === 'black',
      sign = black ? 1 : -1,
      rest = { x: start.x, y: start.y, scale: 0, alpha: 0, angle: 0, frame: 0 };
    if (t <= 0 || t >= duration) return rest;
    if (reduced)
      return {
        ...rest,
        scale: 0.65,
        alpha: Math.sin(Math.PI * clamp(t / 700)),
        x: start.x,
        y: start.y - 0.08,
      };
    let x,
      y,
      scale = 1,
      alpha = 1,
      angle = 0;
    const X = (v) => 0.52 + (v - 0.52) * spread;
    const staging = { x: X(black ? 0.3 : 0.7), y: black ? 0.4 : 0.405 };
    if (t < 350) {
      let p = ease(t / 350);
      x = mix(start.x, staging.x, p);
      y = mix(start.y, staging.y, p);
      scale = mix(0.1, 1, p);
      alpha = p;
    } else if (t < 1120) {
      let p = ease((t - 350) / 770);
      x = mix(staging.x, X(black ? 0.43 : 0.61), p);
      y = mix(staging.y, black ? 0.37 : 0.38, p) - Math.sin(p * Math.PI) * 0.045;
      angle = sign * Math.sin(p * Math.PI) * -0.055;
    } else if (t < 1700) {
      let p = (t - 1120) / 580,
        pulse = Math.sin(p * Math.PI * 4);
      x = X((black ? 0.435 : 0.605) + sign * pulse * 0.014);
      y = (black ? 0.37 : 0.38) + Math.sin(p * Math.PI * 2) * 0.022;
      angle = sign * (-0.055 + Math.sin(p * Math.PI * 4) * 0.045);
    } else if (t < 2350) {
      let p = ease((t - 1700) / 650);
      x = mix(X(black ? 0.435 : 0.605), X(black ? 0.48 : 0.78), p);
      y = mix(black ? 0.37 : 0.38, black ? 0.3 : 0.62, p);
      angle = black ? -0.06 : mix(0.03, -0.28, p);
      if (!black) alpha = 1 - clamp((p - 0.55) / 0.45);
    } else {
      let p = ease((t - 2350) / 400);
      x = mix(X(black ? 0.48 : 0.78), start.x, p);
      y = mix(black ? 0.3 : 0.62, start.y, p);
      alpha = black ? 1 - p : 0;
      scale = 1 - p * 0.7;
      angle = black ? -0.06 * (1 - p) : -0.28;
    }
    return {
      x,
      y,
      scale,
      alpha: clamp(alpha),
      angle,
      frame: [0, 1, 2, 1][Math.floor(t / (black ? 72 : 80)) % 4],
    };
  }
  function sample(t, starts, reduced = false, spread = 1) {
    t = Math.max(0, Math.min(duration, t));
    return {
      t,
      phase: beats.filter((b) => t >= b[0]).at(-1)[1],
      black: pose(t, 'black', starts.black, reduced, spread),
      red: pose(t, 'red', starts.red, reduced, spread),
      particles: !reduced && t >= 1250 && t < 2550,
      complete: t >= duration,
    };
  }
  const api = { duration, beats, sample };
  if (typeof module !== 'undefined') module.exports = api;
  root.HORRavenTimeline741 = api;
})(typeof window !== 'undefined' ? window : globalThis);
