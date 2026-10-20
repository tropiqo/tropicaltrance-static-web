import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

// Bounded parser: JSON.parse alone cannot detect duplicate keys.
export function parseJson(bytes) {
  const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (bytes.length > 1024 * 1024) throw Error('JSON exceeds 1 MiB');
  let i = 0;
  const fail = () => { throw Error(`Invalid/duplicate JSON at byte offset ${i}`); };
  const ws = () => { while (/\s/.test(s[i] || '') && i < s.length) { if (!' \t\r\n'.includes(s[i])) fail(); i++; } };
  function str() {
    const start = i++;
    while (i < s.length) {
      const c = s[i++];
      if (c === '\\') { i++; continue; }
      if (c === '"') {
        const v = JSON.parse(s.slice(start, i));
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)) fail();
        return v;
      }
    }
    fail();
  }
  function value(depth = 0) {
    if (depth > 40) fail(); ws();
    if (s[i] === '"') return str();
    if (s[i] === '{' || s[i] === '[') {
      const object = s[i++] === '{'; const result = object ? {} : []; const end = object ? '}' : ']';
      ws(); if (s[i] === end) { i++; return result; }
      while (i < s.length) {
        ws(); let key;
        if (object) { if (s[i] !== '"') fail(); key = str(); if (Object.hasOwn(result, key)) fail(); ws(); if (s[i++] !== ':') fail(); }
        const v = value(depth + 1);
        if (object) Object.defineProperty(result, key, { value: v, enumerable: true, writable: true, configurable: true }); else result.push(v);
        ws(); const sep = s[i++]; if (sep === end) return result; if (sep !== ',') fail();
      }
      fail();
    }
    const m = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(s.slice(i));
    if (!m) fail(); i += m[0].length; const v = JSON.parse(m[0]);
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER)) fail();
    return v;
  }
  const v = value(); ws(); if (i !== s.length) fail(); return v;
}

// Implements only assertion keywords present in the pinned schemas. No remote resolution.
const allowed = new Set(['$schema','$id','$defs','title','description','$ref','type','const','enum','pattern','not','anyOf','allOf','oneOf','properties','required','additionalProperties','items','minItems','uniqueItems','propertyNames','minimum','maximum','format']);
export function validateSchema(value, schemaFile) {
  const documents = new Map();
  function doc(file) { if (!documents.has(file)) documents.set(file, parseJson(readFileSync(file))); return documents.get(file); }
  function valid(v, schema, file) {
    for (const k of Object.keys(schema)) if (!allowed.has(k)) throw Error(`Unsupported schema keyword ${k}`);
    if (schema.$ref) {
      const [name, fragment = ''] = schema.$ref.split('#');
      if (name.includes(':') || name.startsWith('/')) throw Error('Nonlocal schema reference');
      const target = name ? resolve(dirname(file), name) : file;
      let sub = doc(target);
      for (const key of fragment.split('/').slice(1)) sub = sub?.[key.replaceAll('~1','/').replaceAll('~0','~')];
      if (!sub || !valid(v, sub, target)) return false;
    }
    const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (schema.type && schema.type !== type) return false;
    if (Object.hasOwn(schema,'const') && !isDeepStrictEqual(v,schema.const)) return false;
    if (schema.enum && !schema.enum.some(x => isDeepStrictEqual(x,v))) return false;
    if (schema.not && valid(v,schema.not,file)) return false;
    if (schema.allOf && !schema.allOf.every(x => valid(v,x,file))) return false;
    if (schema.anyOf && !schema.anyOf.some(x => valid(v,x,file))) return false;
    if (schema.oneOf && schema.oneOf.filter(x => valid(v,x,file)).length !== 1) return false;
    if (type === 'string') {
      if (schema.pattern && !new RegExp(schema.pattern,'u').test(v)) return false;
      if (schema.format) {
        if (schema.format !== 'date-time') throw Error('Unsupported format');
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(v);
        if (!m) return false;
        const [,y,mo,d,h,mi,se,tz] = m;
        const leap = +y % 4 === 0 && (+y % 100 !== 0 || +y % 400 === 0);
        const days = [31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
        if (+mo<1 || +mo>12 || +d<1 || +d>days[+mo-1] || +h>23 || +mi>59 || +se>59 || (tz !== 'Z' && (+tz.slice(1,3)>23 || +tz.slice(4)>59))) return false;
      }
    }
    if (type === 'number' && ((schema.minimum !== undefined && v < schema.minimum) || (schema.maximum !== undefined && v > schema.maximum))) return false;
    if (type === 'array') {
      if (schema.minItems !== undefined && v.length < schema.minItems) return false;
      if (schema.uniqueItems && v.some((x,i) => v.slice(0,i).some(y=>isDeepStrictEqual(x,y)))) return false;
      if (schema.items && !v.every(x=>valid(x,schema.items,file))) return false;
    }
    if (type === 'object') {
      if (schema.required?.some(k=>!Object.hasOwn(v,k))) return false;
      for (const [k,x] of Object.entries(v)) {
        if (schema.propertyNames && !valid(k,schema.propertyNames,file)) return false;
        if (schema.properties && Object.hasOwn(schema.properties,k)) { if (!valid(x,schema.properties[k],file)) return false; }
        else if (schema.additionalProperties === false) return false;
        else if (schema.additionalProperties && !valid(x,schema.additionalProperties,file)) return false;
      }
    }
    return true;
  }
  const file = resolve(schemaFile);
  if (!valid(value,doc(file),file)) throw Error(`Closed schema validation failed: ${schemaFile}`);
  return value;
}
