import { AbstractStage } from "/client/lib/abstract";
import { assert, Point } from "/lib/base";
import { stroke_extractor, Endpoint } from "/lib/stroke_extractor";

const bridgeKey = (bridge) => bridge.map(Point.key).join("-");

const removeBridge = (bridges, bridge) => {
  const keys = {};
  keys[bridgeKey(bridge)] = true;
  keys[bridgeKey([bridge[1], bridge[0]])] = true;
  return bridges.filter((bridge) => !keys[bridgeKey(bridge)]);
};

class BridgesStage extends AbstractStage {
  constructor(glyph) {
    super("bridges");
    const bridges = stroke_extractor.getBridges(glyph.stages.path);
    this.original = bridges.bridges;
    this.adjusted = glyph.stages.bridges || this.original;
    this.endpoints = bridges.endpoints.reduce((x, y) => x.concat(y), []);
    this.path = glyph.stages.path;
    this.selected_point = undefined;
  }
  handleClickOnBridge(bridge) {
    this.adjusted = removeBridge(this.adjusted, bridge);
  }
  handleClickOnPoint(point) {
    if (this.selected_point === undefined) {
      this.selected_point = point;
      return;
    } else if (Point.equal(point, this.selected_point)) {
      this.selected_point = undefined;
      return;
    }
    const bridge = [point, this.selected_point];
    this.selected_point = undefined;
    const without = removeBridge(this.adjusted, bridge);
    if (without.length < this.adjusted.length) {
      return;
    }
    this.adjusted.push(bridge);
  }

  handleEvent(event, template) {
    if (template.x1 !== undefined) {
      const bridge = [
        [template.x1, template.y1],
        [template.x2, template.y2],
      ];
      this.handleClickOnBridge(bridge);
    } else if (template.cx !== undefined) {
      this.handleClickOnPoint([template.cx, template.cy]);
    }
  }

  createPoint(event) {
    const svg = $("svg g");
    var p = new DOMPoint(event.pageX, event.pageY);

    var sp = p.matrixTransform(svg[0].getScreenCTM().inverse());
    sp = [sp.x, sp.y];
    console.log(sp);

    var min = Infinity;
    var closest = this.endpoints[0];

    let debug = [{}];
    this.endpoints
      .map((e) => {
        if (e.segments[0].control === undefined) {
          return [getBounds(e.segments[0].start, e.segments[0].end), e];
          // return [Point.midpoint(e.segments[0].start, e.segments[0].end), e];
        } else {
          return [
            getBounds(
              e.segments[0].start,
              e.segments[0].end,
              e.segments[0].control,
            ),
            e,
          ];
          // return [e.segments[0].control, e];
        }
      })
      // fun coincidence lol abcde
      .forEach(([[a, b, c, d], e]) => {
        // a is [maxx, maxy] and d is [minx, miny] so only these are needed.
        let p = [undefined, undefined];
        p[0] = Math.max(d[0] - sp[0], 0, sp[0] - a[0]);
        p[1] = Math.max(d[1] - sp[1], 0, sp[1] - a[1]);

        debug.push({
          d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${d[0]} ${d[1]} L ${c[0]} ${c[1]} Z`,
          fill: "rgba(22, 222, 33,0.25)",
          stroke: "green",
        });
        let dist = Point.distance2(a, sp);

        if (dist < min) {
          min = dist;
          closest = e;

          debug[0] = {
            d: `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${d[0]} ${d[1]} L ${c[0]} ${c[1]} Z`,
            fill: "rgba(222, 99, 22,0.5)",
            stroke: "orange",
          };
        }
      });
    Session.set("stage.paths", [
      { d: this.path, fill: "gray", stroke: "black" },
      ...debug,
    ]);

    var cp = closest.point;
    var seg = closest.segments;
    assert(seg.length === 2, "Not enough segments!");
    console.log(seg[0]);
    var start = seg[0].start;
    var end = seg[0].end;
    var control = seg[0].control;

    var t;
    var x;
    var y;
    var precision = 100; //number of iterations
    const epsilon = 1e-6; //threshold
    var low = 0;
    var high = 1;

    for (let i = 0; i < precision; i++) {
      var mid = (low + high) / 2;
      var d_low = Point.distance2(bezierPoint(low, start, end, control), sp);
      var d_mid = Point.distance2(bezierPoint(mid, start, end, control), sp);
      var d_high = Point.distance2(bezierPoint(high, start, end, control), sp);

      if (d_mid < epsilon) {
        t = mid;
      }

      if (d_low < d_high) {
        high = mid;
      } else {
        low = mid;
      }
    }
    t = (low + high) / 2;
    [x, y] = bezierPoint(t, start, end, control);

    //`M ${cp.x} ${cp.y}`
    const entry = {
      cls: "success",
      message:
        `closest: (${cp[0]},${cp[1]})\n` +
        `start:   (${start[0]},${start[1]})\n` +
        `end:     (${end[0]},${end[1]})`,
    };
    Session.set("stage.points", [
      ...[start, end].map((i) => {
        return {
          cls: "selectable",
          cx: i[0],
          cy: i[1],
          fill: "green",
          stroke: "black",
        };
      }),
      {
        cls: "selectable",
        cx: x,
        cy: y,
        fill: "red",
        stroke: "black",
      },
    ]);
    // Session.set("stage.paths", [
    //   { d: this.path, fill: "gray", stroke: "black" },
    //   {
    //     d: `M ${seg[0].start[0]} ${seg[0].start[1]} Q ${seg[0].control[0]} ${seg[0].control[1]} ${seg[0].end[0]} ${seg[0].end[1]}`,
    //     fill: "none",
    //     stroke: "orange",
    //   },
    // ]);
    Session.set("stage.status", [entry]);
  }

  refreshUI() {
    Session.set("stage.paths", [
      { d: this.path, fill: "gray", stroke: "gray" },
    ]);
    const keys = {};
    this.original.map((bridge) => {
      keys[bridgeKey(bridge)] = true;
      keys[bridgeKey([bridge[1], bridge[0]])] = true;
    });
    Session.set(
      "stage.lines",
      this.adjusted.map((bridge) => ({
        cls: "selectable",
        stroke: keys[bridgeKey(bridge)] ? "red" : "purple",
        x1: bridge[0][0],
        y1: bridge[0][1],
        x2: bridge[1][0],
        y2: bridge[1][1],
      })),
    );
    Session.set(
      "stage.points",
      this.endpoints.map((endpoint) => {
        let color = endpoint.corner ? "red" : "black";
        if (
          this.selected_point &&
          Point.equal(endpoint.point, this.selected_point)
        ) {
          color = "purple";
        }
        return {
          cls: "selectable",
          cx: endpoint.point[0],
          cy: endpoint.point[1],
          fill: color,
          stroke: color,
        };
      }),
    );
    const strokes = stroke_extractor.getStrokes(this.path, this.adjusted);
    const n = strokes.strokes.length;
    const message = `Extracted ${n} stroke${n == 1 ? "" : "s"}.`;
    const entry = { cls: "success", message: message };
    Session.set("stage.status", strokes.log.concat([entry]));
  }
}

//NOTE: this only works for quadratic and linear beziers.
function bezierPoint(t, start, end, control = undefined) {
  var x, y;
  if (control === undefined) {
    [x, y] = Point.add(Point.scale(end, t), Point.scale(start, 1 - t));
  } else {
    x =
      (1 - t) * (1 - t) * start[0] +
      2 * (1 - t) * t * control[0] +
      t * t * end[0];
    y =
      (1 - t) * (1 - t) * start[1] +
      2 * (1 - t) * t * control[1] +
      t * t * end[1];
  }
  return [x, y];
}

function getBounds(start, end, control = undefined) {
  let maxx, maxy, minx, miny;

  // eazy win we already have the diagonal of a box
  if (control === undefined) {
    [maxx, minx] = start[0] > end[0] ? [start[0], end[0]] : [end[0], start[0]];
    [maxy, miny] = start[1] > end[1] ? [start[1], end[1]] : [end[1], start[1]];
  }
  // For quadratics, we need to find the extrama first
  let extrema = getExtrema(start, end, control);
  [maxx, maxy] = extrema.max;
  [minx, miny] = extrema.min;

  // rect:
  // A-B
  // | |
  // C-D
  // is defined as [A,B,C,D]
  return [
    [minx, miny],
    [maxx, miny],
    [minx, maxy],
    [maxx, maxy],
  ];
}

function getExtrema(start, end, control) {
  // For linear beziers,
  // there are only two possible extrema: t=1 and t=0
  // so we just evaluate them and see which is bigger
  if (control === undefined) {
    let p1 = bezierPoint(1, start, end);
    let p0 = bezierPoint(0, start, end);
    return p1[1] > p0[0]
      ? {
          max: p1,
          min: p0,
        }
      : {
          max: p0,
          min: p1,
        };
  }

  // For quadratic beziers,
  // there are three possible extrema: t=0, t=1
  // or B'(t) = 0, but only two will be real extrema
  // (one minimum and one maximum)

  // compute t1 (t=0) and t2 (t=1)
  console.log(start);
  console.log(end);
  console.log(control);
  let t1 = 1;
  let t2 = 0;
  let p1 = bezierPoint(1, start, end, control);
  let p2 = bezierPoint(0, start, end, control);

  // This variable is used to check if t3 is the
  // minima or maxima. true if y1 < y2
  let reverse = p1[1] < p2[1] ? true : false;

  let t3 = -start[1] / (control[1] - end[1]);

  // check if our solution is within 0 to 1
  console.log("FINDING SHIT:");
  console.log(t1);
  console.log(t2);
  if (t3 > 0 && t3 < 1) {
    // It is, so we have either a new min or max
    let extrema = bezierPoint(t3);
    console.log(t3);
    // If y1 > y2
    if (reverse) {
      if (extrema[1] > p1[1]) {
        return { max: extrema, min: p1 };
      }
      if (extrema[1] < p2[1]) {
        return { max: p1, min: extrema };
      }
    } else {
      if (extrema[1] < p1[1]) {
        return { max: p1, min: extrema };
      }
      if (extrema[1] > p2[1]) {
        return { max: extrema, min: p2 };
      }
    }
  }

  // no early return means that there is no solution to B'(t) = 0,
  // meaning that we can just return p1 and p2 and our max and min
  return reverse ? { max: p1, min: p2 } : { max: p2, min: p1 };
}

// Linear first derivative, i dont think i need this rn
// // For linear beziers, the derivative is a constant
// // since there is no rate of change in the gradient
// if ((control = undefined)) {
//     // rize over run to find the gradient
//     let m = (end[1] - start[1]) / (end[0] - start[0]);
//     // gradient is the first derivative
//     return (_t) => m;
// }

export { BridgesStage };
