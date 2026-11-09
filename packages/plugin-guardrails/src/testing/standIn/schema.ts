/* Minimal OpenAPI 3.0 schema checker for the contract test. It understands the
 * parts of the language that c1-openapi.yaml uses. A stand-in answer with a
 * property the spec does not list fails (the stand-in must not invent fields). */

type Schema = Record<string, any>;

export interface Spec {
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, Schema>;
    responses: Record<string, Schema>;
    parameters?: Record<string, Schema>;
  };
}

function resolve(spec: Spec, node: Schema): Schema {
  if (node && typeof node.$ref === 'string') {
    const parts = node.$ref.replace(/^#\//, '').split('/');
    let cur: any = spec;
    for (const p of parts) cur = cur?.[p];
    if (!cur) throw new Error(`Unresolved $ref ${node.$ref}`);
    return resolve(spec, cur);
  }
  return node;
}

export function validate(
  spec: Spec,
  schemaNode: Schema,
  value: unknown,
  path = '$',
): string[] {
  const schema = resolve(spec, schemaNode);
  const errors: string[] = [];
  const type = schema.type as string | undefined;

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
    return errors;
  }
  switch (type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return [`${path}: expected object`];
      }
      const obj = value as Record<string, unknown>;
      for (const req of schema.required ?? []) {
        if (!(req in obj) || obj[req] === undefined)
          errors.push(`${path}: missing required ${req}`);
      }
      const props = schema.properties ?? {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (!(k in props)) {
          errors.push(`${path}: unexpected property ${k}`);
        } else {
          errors.push(...validate(spec, props[k], v, `${path}.${k}`));
        }
      }
      return errors;
    }
    case 'array': {
      if (!Array.isArray(value)) return [`${path}: expected array`];
      if (schema.maxItems !== undefined && value.length > schema.maxItems)
        errors.push(`${path}: more than ${schema.maxItems} items`);
      value.forEach((v, i) =>
        errors.push(...validate(spec, schema.items, v, `${path}[${i}]`)),
      );
      return errors;
    }
    case 'string':
      return typeof value === 'string' ? [] : [`${path}: expected string`];
    case 'integer':
      if (!Number.isInteger(value)) return [`${path}: expected integer`];
      if (schema.minimum !== undefined && (value as number) < schema.minimum)
        errors.push(`${path}: below minimum`);
      return errors;
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path}: expected boolean`];
    default:
      return errors;
  }
}

/** The schema a response of this status declares, or undefined for none. */
export function responseSchema(
  spec: Spec,
  template: string,
  method: string,
  status: number,
): { declared: boolean; schema?: Schema } {
  const op = spec.paths[template]?.[method.toLowerCase()];
  const resp = op?.responses?.[String(status)];
  if (!resp) return { declared: false };
  const r = resolve(spec, resp);
  const schema = r.content?.['application/json']?.schema;
  return { declared: true, schema };
}

/** Finds the spec path template that matches a concrete path (after /api/guardrails). */
export function templateFor(spec: Spec, path: string): string | undefined {
  for (const template of Object.keys(spec.paths)) {
    const re = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    if (re.test(path)) return template;
  }
  return undefined;
}
