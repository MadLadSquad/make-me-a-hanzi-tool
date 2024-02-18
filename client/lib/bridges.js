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

    this.endpoints
      .map((e) => {
        if (e.segments[0].control === undefined) {
          return [Point.midpoint(e.segments[0].start, e.segments[0].end), e];
        } else {
          return [e.segments[0].control, e];
        }
      })
      .forEach(([a, e]) => {
        var dist = Point.distance2(a, sp);
        if (dist < min) {
          min = dist;
          closest = e;
        }
      });

    var cp = closest.point;
    var seg = closest.segments;
    assert(seg.length === 2, "Not enough segments!");
    console.log(seg[0]);
    var start = seg[0].start;
    var end = seg[0].end;

    var t = 0.5; //TODO: binary search for closest xy
    var x;
    var y;
    if (seg[0].control === undefined) {
      [x, y] = Point.add(Point.scale(end, t), Point.scale(start, 1 - t));
    } else {
      x =
        (1 - t) * (1 - t) * seg[0].start[0] +
        2 * (1 - t) * t * seg[0].control[0] +
        t * t * seg[0].end[0];
      y =
        (1 - t) * (1 - t) * seg[0].start[1] +
        2 * (1 - t) * t * seg[0].control[1] +
        t * t * seg[0].end[1];
    }

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

export { BridgesStage };
