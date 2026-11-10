"use strict";(()=>{(self.webpackChunk=self.webpackChunk||[]).push([[7657],{17657(bn,c,n){n.d(c,{G:()=>un});var d=n(2038),m=n(30371),f=n(9735),u=n(86352),p=n(95507),b=n(71368),h=n(26405),y=n(17144),g=n(52697),v=n(6392),w=n(59708),x=n(36926),T=n(4563),R=n(98338),P=n(42705),A=n(66034),M=n(87702),z=n(72951),I=n(87372),j=n(42497),E=n(49471),C=n(43952),U=n(68648),B=n(34545),D=n(90831),F=n(10747),S=n(81748),L=n(6087),N=n(28052),O=n(61434),G=n(48075),k=n(27344),H=n(58311),V=n(41804),Y=n(96572),$=n(41925),Q=n(68346),W=n(94194),X=n(97576),J=n(34353),K=n(39727),Z=n(57199),_=n(14655),q=n(21790),a=n(20261),nn=n(74805),en=n(98846),tn=n(83218),sn=n(90888),rn=n(1224),on=n(31298);const r="lib.d.ts",an=`
  declare type BaseTypes<T> = number | string | boolean | void | null | T;
  declare type LogArgs = { [key: string]: BaseTypes<LogArgs> | BaseTypes<LogArgs>[] };
  declare var log: (...args: Array<BaseTypes<LogArgs> | BaseTypes<LogArgs>[]>) => void;
`,i=new Map(Object.entries({es5:on,es2015:p,es2016:R,es2017:P,es2018:U,es2019:L,es2020:H,es2021:X,es2022:a,"es2015.core":u,"es2015.collection":f,"es2015.iterable":h,"es2015.generator":b,"es2015.promise":y,"es2015.proxy":g,"es2015.reflect":v,"es2015.symbol":w,"es2015.symbol.wellknown":x,"es2016.array.include":T,"es2017.object":M,"es2017.sharedmemory":z,"es2017.string":I,"es2017.intl":A,"es2017.typedarrays":j,"es2018.asynciterable":C,"es2018.asyncgenerator":E,"es2018.promise":D,"es2018.regexp":F,"es2018.intl":B,"es2019.array":S,"es2019.object":N,"es2019.string":O,"es2019.symbol":G,"es2020.bigint":k,"es2020.promise":Y,"es2020.sharedmemory":$,"es2020.string":Q,"es2020.symbol.wellknown":W,"es2020.intl":V,"es2021.intl":J,"es2021.promise":K,"es2021.string":Z,"es2021.weakref":_,"es2022.array":q,"es2022.error":nn,"es2022.intl":en,"es2022.object":tn,"es2022.regexp":sn,"es2022.string":rn}));function l(e){return e.replace(/\/\/\/ <reference lib="(.+)" \/>/g,(pn,t)=>{const s=i.get(t);return i.delete(t),s==null?"":l(s)})}const ln=`${l(a)}

${an}`,cn=[{fileName:"pointClouds.ts",sourceCode:`import { FieldReader, getReader } from "./readers";
import { Point, Header, RGBA } from "./types";

interface sensor_msgs__PointField {
  name: string;
  offset: number;
  datatype: number;
  count: number;
}

export interface sensor_msgs__PointCloud2 {
  header: Header;
  height: number;
  width: number;
  fields: sensor_msgs__PointField[];
  is_bigendian: boolean;
  point_step: number;
  row_step: number;
  data: Uint8Array;
  is_dense: boolean;
}

type Reader = { datatype: number; offset: number; reader: FieldReader };

function getFieldOffsetsAndReaders(fields: sensor_msgs__PointField[]): Reader[] {
  const result: Reader[] = [];
  for (const { datatype, offset = 0 } of fields) {
    result.push({ datatype, offset, reader: getReader(datatype, offset) });
  }
  return result;
}

type Field = number | string;

/**
 * Read points from a sensor_msgs.PointCloud2 message. Returns a nested array
 * of values whose index corresponds to that of the 'fields' value.
 */
export const readPoints = (message: sensor_msgs__PointCloud2): Array<Field[]> => {
  const { fields, height, point_step, row_step, width, data } = message;
  const readers = getFieldOffsetsAndReaders(fields);

  const points: Array<Field[]> = [];
  for (let i = 0; i < height; i++) {
    const dataOffset = i * row_step;
    for (let j = 0; j < width; j++) {
      const row: Field[] = [];
      const dataStart = j * point_step + dataOffset;
      for (const reader of readers) {
        const value = reader.reader.read(data, dataStart);
        row.push(value);
      }
      points.push(row);
    }
  }
  return points;
};

export function norm({ x, y, z }: Point): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function setRayDistance(pt: Point, distance: number): Point {
  const { x, y, z } = pt;
  const scale = distance / norm(pt);
  return {
    x: x * scale,
    y: y * scale,
    z: z * scale,
  };
}

// eslint-disable-next-line @lichtblick/no-boolean-parameters
export function convertToRangeView(points: Point[], range: number, makeColors: boolean): RGBA[] {
  const colors: RGBA[] = makeColors ? new Array(points.length) : [];
  // First pass to get min and max ranges
  let maxRange = Number.MIN_VALUE;
  if (makeColors) {
    for (const point of points) {
      maxRange = Math.max(maxRange, norm(point));
    }
  }
  // actually move the points and generate colors if specified
  for (let i = 0; i < points.length; ++i) {
    const pt = points[i]!;
    if (makeColors) {
      const dist = norm(pt);
      if (dist <= range) {
        // don't go all the way to white
        const extent = 0.8;
        // closest to target range is lightest,
        // closest to AV is darkest
        const other = (extent * dist) / range;
        colors[i] = { r: 1, g: other, b: other, a: 1 };
      } else {
        // don't go all the way to white
        const extent = 0.8;
        // closest to target range is lightest,
        // closest to max range is darkest
        const upper = maxRange - range;
        const other = extent * (1.0 - dist / upper);
        colors[i] = { r: other, g: other, b: 1, a: 1 };
      }
    }
    points[i] = setRayDistance(pt, range);
  }
  return colors;
}
`},{fileName:"quaternions.ts",sourceCode:`// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Euler = {
  roll: number;
  pitch: number;
  yaw: number;
};

/**
 * Converts a quaternion to a Euler roll, pitch, yaw representation, in degrees.
 *
 * @param quaternion Input quaternion.
 * @returns Converted Euler angle roll, pitch, yaw representation, in degrees.
 */
export function quaternionToEuler(quaternion: Quaternion): Euler {
  const { x, y, z, w } = quaternion;

  const toDegrees = 180 / Math.PI;
  const dcm00 = w * w + x * x - y * y - z * z;
  const dcm10 = 2 * (x * y + w * z);
  const dcm20 = 2 * (x * z - w * y);
  const dcm21 = 2 * (w * x + y * z);
  const dcm22 = w * w - x * x - y * y + z * z;
  const roll = toDegrees * Math.atan2(dcm21, dcm22);
  const pitch = toDegrees * Math.asin(-dcm20);
  const yaw = toDegrees * Math.atan2(dcm10, dcm00);
  return {
    roll,
    pitch,
    yaw,
  };
}
`},{fileName:"readers.ts",sourceCode:`export const DATATYPE = {
  uint8: 2,
  uint16: 4,
  int16: 3,
  int32: 5,
  float32: 7,
};

export interface FieldReader {
  read(data: Uint8Array, index: number): number;
}

export class Float32Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(4);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 4;
    if (data.length < base + size) {
      throw new Error("cannot read Float32 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    this.#view.setUint8(2, data[base + 2]!);
    this.#view.setUint8(3, data[base + 3]!);
    return this.#view.getFloat32(0, true);
  }
}

export class Int32Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(4);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 4;
    if (data.length < base + size) {
      throw new Error("cannot read Int32 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    this.#view.setUint8(2, data[base + 2]!);
    this.#view.setUint8(3, data[base + 3]!);
    return this.#view.getInt32(0, true);
  }
}

export class Uint16Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(2);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 2;
    if (data.length < base + size) {
      throw new Error("cannot read Uint16 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    return this.#view.getUint16(0, true);
  }
}

export class Uint8Reader implements FieldReader {
  #offset: number;
  public constructor(offset: number) {
    this.#offset = offset;
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 1;
    if (data.length < base + size) {
      throw new Error("cannot read Uint8 from data - not enough data");
    }
    return data[base]!;
  }
}

export class Int16Reader implements FieldReader {
  #offset: number;
  #view: DataView;
  public constructor(offset: number) {
    this.#offset = offset;
    const buffer = new ArrayBuffer(2);
    this.#view = new DataView(buffer);
  }

  public read(data: Uint8Array, index: number): number {
    const base = index + this.#offset;
    const size = 2;
    if (data.length < base + size) {
      throw new Error("cannot read Int16 from data - not enough data");
    }
    this.#view.setUint8(0, data[base]!);
    this.#view.setUint8(1, data[base + 1]!);
    return this.#view.getInt16(0, true);
  }
}

export function getReader(datatype: number, offset: number): FieldReader {
  switch (datatype) {
    case DATATYPE.float32:
      return new Float32Reader(offset);
    case DATATYPE.uint8:
      return new Uint8Reader(offset);
    case DATATYPE.uint16:
      return new Uint16Reader(offset);
    case DATATYPE.int16:
      return new Int16Reader(offset);
    case DATATYPE.int32:
      return new Int32Reader(offset);
    default:
      throw new Error(\`Unsupported datatype: '\${datatype}'\`);
  }
}
`},{fileName:"time.ts",sourceCode:`import { Time } from "./types";

/*
 * Checks ROS-time equality.
 */
export const areSame = (t1: Time, t2: Time): boolean => t1.sec === t2.sec && t1.nsec === t2.nsec;

/*
 * Compare two times, returning a negative value if the right is greater or a
 * positive value if the left is greater or 0 if the times are equal useful to
 * supply to Array.prototype.sort
 */
export const compare = (left: Time, right: Time): number => {
  const secDiff = left.sec - right.sec;
  return secDiff !== 0 ? secDiff : left.nsec - right.nsec;
};

const fixTime = (t: Time): Time => {
  // Equivalent to fromNanoSec(toNanoSec(t)), but no chance of precision loss.
  // nsec should be non-negative, and less than 1e9.
  let { sec, nsec } = t;
  while (nsec > 1e9) {
    nsec -= 1e9;
    sec += 1;
  }
  while (nsec < 0) {
    nsec += 1e9;
    sec -= 1;
  }
  return { sec, nsec };
};

export const subtractTimes = (
  { sec: sec1, nsec: nsec1 }: Time,
  { sec: sec2, nsec: nsec2 }: Time,
): Time => {
  return fixTime({ sec: sec1 - sec2, nsec: nsec1 - nsec2 });
};
`},{fileName:"types.ts",sourceCode:`// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageTypeByTopic, MessageTypeBySchemaName } from "./generatedTypes";

/**
 * Message is a generic type for getting the type of a message for a schema name.
 *
 * \`\`\`
 * type GeometryPose = Message<"geometry_msgs/Pose">;
 * type PkgGeometryPose = Message<"pkg.geometry.Pose">;
 * \`\`\`
 */
export type Message<T extends keyof MessageTypeBySchemaName> = MessageTypeBySchemaName[T];

/**
 * Input type is a generic type for getting the event type on a topic.
 *
 * Most commonly used to type the input argument to your process function.
 *
 * \`\`\`
 * function process(msgEvent: Input<"/points">) { ... }
 * \`\`\`
 */
export type Input<T extends keyof MessageTypeByTopic> = {
  topic: T;
  receiveTime: Time;
  message: MessageTypeByTopic[T];
};

export type RGBA = {
  // all values are scaled between 0-1 instead of 0-255
  r: number;
  g: number;
  b: number;
  a: number; // opacity -- typically you should set this to 1.
};

export type Header = {
  frame_id: string;
  stamp: Time;
  seq: number;
};

export type Point = {
  x: number;
  y: number;
  z: number;
};

export type Time = {
  sec: number;
  nsec: number;
};

export type Translation = {
  x: number;
  y: number;
  z: number;
};

export type Rotation = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Pose = {
  position: Point;
  orientation: Quaternion;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Transform = {
  header: Header;
  child_frame_id: string;
  transform: {
    translation: Translation;
    rotation: Rotation;
  };
};
`},{fileName:"vectors.ts",sourceCode:`import { Point, Rotation } from "./types";

type vec3 = [number, number, number];

/*
 * Dot-product of two vectors.
 */
export function dot(vec1: number[], vec2: number[]): number {
  let ret = 0.0;
  for (let i = 0; i < vec1.length && i < vec2.length; ++i) {
    ret += vec1[i]! * vec2[i]!;
  }
  return ret;
}

/*
 * Cross-product of two vectors.
 */
export function cross(vec1: vec3, vec2: vec3): vec3 {
  const [ax, ay, az] = vec1;
  const [bx, by, bz] = vec2;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

/*
 * Performs a rotation transformation on a point.
 */
export function rotate(rotation: Rotation, point: Point): Point {
  const v: vec3 = [point.x, point.y, point.z];

  // Extract the vector part of the quaternion
  const u: vec3 = [rotation.x, rotation.y, rotation.z];

  // Extract the scalar part of the quaternion
  const s = -1 * rotation.w;

  // Do the math
  const t1 = scalarMultiply(u, 2.0 * dot(u, v));
  const t2 = scalarMultiply(v, s * s - dot(u, u));
  const t3 = scalarMultiply(cross(u, v), 2 * s);
  const d = vectorAddition([t1, t2, t3]);

  return {
    x: d[0]!,
    y: d[1]!,
    z: d[2]!,
  };
}

/*
 * Scales a vector.
 */
export function scalarMultiply(vector: number[], scalar: number): number[] {
  const ret = vector.slice();
  let i;
  for (i = 0; i < ret.length; ++i) {
    ret[i]! *= scalar;
  }
  return ret;
}

/*
 * Sums an array of vectors.
 * NOTE: all the vector arrays must be at least the length of the first vector
 */
export function vectorAddition(vectors: number[][]): number[] {
  const first = vectors[0];
  if (!first) {
    throw new Error("vectorAddition requires vectors");
  }

  const ret = first.slice();
  for (let i = 1; i < vectors.length; ++i) {
    for (let j = 0; j < ret.length; ++j) {
      ret[j] = (ret[j] ?? 0) + vectors[i]![j]!;
    }
  }
  return ret;
}
`},{fileName:"markers.ts",sourceCode:`// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Header, Point, Pose, RGBA, Time } from "./types";

export interface IMarker {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  pose: Pose;
  scale: Point;
  color: RGBA;
  lifetime: Time;
  frame_locked: boolean;
  points: Point[];
  colors: RGBA[];
  text: string;
  mesh_resource: string;
  mesh_use_embedded_materials: boolean;
}

export type IRosMarker = IMarker;

export interface ImageMarker {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  position: Point;
  scale: number;
  outline_color: RGBA;
  filled: boolean;
  fill_color: RGBA;
  lifetime: Time;
  points: Point[];
  outline_colors: RGBA[];
}

/**
 * buildRosMarker builds a complete Marker message from an optional set of args.
 *
 * See https://foxglove.dev/docs/panels/3d for a list of supported Marker types
 *
 * @param args override any defaults in the marker fields
 * @returns an IRosMarker instance with default values for any omitted args
 */
export function buildRosMarker(args?: Partial<IRosMarker>): IRosMarker {
  const {
    header,
    ns,
    id,
    type,
    action,
    pose,
    scale,
    color,
    lifetime,
    frame_locked,
    points,
    colors,
    text,
    mesh_resource,
    mesh_use_embedded_materials,
  } = args ?? {};

  return {
    header: header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    },
    ns: ns ?? "",
    id: id ?? 0,
    type: type ?? 0,
    action: action ?? 0,
    pose: pose ?? {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      orientation: {
        x: 0,
        y: 0,
        z: 0,
        w: 0,
      },
    },
    scale: scale ?? { x: 0, y: 0, z: 0 },
    color: color ?? { r: 0, g: 0, b: 0, a: 0 },
    lifetime: lifetime ?? { sec: 0, nsec: 0 },
    frame_locked: frame_locked ?? false,
    points: points ?? [],
    colors: colors ?? [],
    text: text ?? "",
    mesh_resource: mesh_resource ?? "",
    mesh_use_embedded_materials: mesh_use_embedded_materials ?? false,
  };
}

/**
 * buildImageMarker builds a complete Marker message from an optional set of args.
 *
 * See https://foxglove.dev/docs/studio/panels/image for a list of supported Marker types
 *
 * @param args override any defaults in the marker fields
 * @returns an ImageMarker instance with default values for any omitted args
 */
export function buildImageMarker(args?: Partial<ImageMarker>): ImageMarker {
  const {
    header,
    ns,
    id,
    type,
    action,
    lifetime,
    points,
    outline_color,
    outline_colors,
    filled,
    fill_color,
    position,
    scale,
  } = args ?? {};

  return {
    header: header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    },
    ns: ns ?? "",
    id: id ?? 0,
    type: type ?? 0,
    action: action ?? 0,
    position: position ?? {
      x: 0,
      y: 0,
      z: 0,
    },
    scale: scale ?? 1,
    outline_color: outline_color ?? { r: 0, g: 0, b: 0, a: 0 },
    lifetime: lifetime ?? { sec: 0, nsec: 0 },
    points: points ?? [],
    outline_colors: outline_colors ?? [],
    filled: filled ?? false,
    fill_color: fill_color ?? { r: 0, g: 0, b: 0, a: 0 },
  };
}

/**
 * Use this class to instantiate marker-like objects with defaulted values.
 *
 * @deprecated prefer \`buildRosMarker({ ... })\` instead
 */
export class Marker implements IMarker {
  public header: Header = {
    frame_id: "",
    stamp: {
      sec: 0,
      nsec: 0,
    },
    seq: 0,
  };
  public ns = "";
  public id = 0;
  public type = 0;
  public action = 0;
  public pose: Pose = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    orientation: {
      x: 0,
      y: 0,
      z: 0,
      w: 0,
    },
  };
  public scale: Point = {
    x: 0,
    y: 0,
    z: 0,
  };
  public color: RGBA = { r: 0, g: 0, b: 0, a: 0 };
  public lifetime: Time = { sec: 0, nsec: 0 };
  public frame_locked = false;
  public points: Point[] = [];
  public colors: RGBA[] = [];
  public text = "";
  public mesh_resource = "";
  public mesh_use_embedded_materials = false;

  public constructor({
    header,
    ns,
    id,
    type,
    action,
    pose,
    scale,
    color,
    lifetime,
    frame_locked,
    points,
    colors,
    text,
    mesh_resource,
    mesh_use_embedded_materials,
  }: Partial<IMarker>) {
    this.header = header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    };
    this.ns = ns ?? "";
    this.id = id ?? 0;
    this.type = type ?? 0;
    this.action = action ?? 0;
    this.pose = pose ?? {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      orientation: {
        x: 0,
        y: 0,
        z: 0,
        w: 0,
      },
    };
    this.scale = scale ?? { x: 0, y: 0, z: 0 };
    this.color = color ?? { r: 0, g: 0, b: 0, a: 0 };
    this.lifetime = lifetime ?? { sec: 0, nsec: 0 };
    this.frame_locked = frame_locked ?? false;
    this.points = points ?? [];
    this.colors = colors ?? [];
    this.text = text ?? "";
    this.mesh_resource = mesh_resource ?? "";
    this.mesh_use_embedded_materials = mesh_use_embedded_materials ?? false;
  }
}
/**
 * Corresponds to the 'type' field of a marker.
 */
export enum MarkerTypes {
  ARROW = 0,
  CUBE = 1,
  SPHERE = 2,
  CYLINDER = 3,
  LINE_STRIP = 4,
  LINE_LIST = 5,
  CUBE_LIST = 6,
  SPHERE_LIST = 7,
  POINTS = 8,
  TEXT = 9,
  MESH = 10,
  TRIANGLE_LIST = 11,
}
`}];var o=n(19237),dn=n(26288);function mn(){return m.A([...(0,d.exportTypeScriptSchemas)({includeTypedArrays:!0}).entries()],([t])=>t).map(([t,s])=>({fileName:`@foxglove/schemas/${t}.ts`,filePath:`@foxglove/schemas/${t}.ts`,sourceCode:s.replaceAll(/export enum (\w+) {/g,"export const enum $1 {")}))}const fn=cn.map(e=>({...e,filePath:`${dn.ke}${e.fileName}`}));function un(){const e=[];return e.push({fileName:r,filePath:r,sourceCode:ln}),e.push(...mn()),{defaultLibFileName:r,rosLib:{fileName:o.h,filePath:`/node_modules/${o.h}`,sourceCode:o.v},declarations:e,utilityFiles:fn}}}}]);})();

//# sourceMappingURL=7657.8b06d1c5c2a1c07a7fdf.js.map