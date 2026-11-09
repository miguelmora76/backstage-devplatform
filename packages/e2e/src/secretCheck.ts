export interface SecretExemption {
  key: string;
  value: string;
}

const SECRET_KEY =
  /(PASSWORD|TOKEN|SECRET|API_?KEY|PRIVATE_?KEY|CONNECTION_STRING)/i;
const ADDRESS_WITH_PASSWORD = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@$]+@/i;

function isSubstitutionOrEmpty(value: string): boolean {
  return value === '' || /^\$\{[^}]+\}$/.test(value);
}

function visit(
  node: unknown,
  path: string,
  exemptions: SecretExemption[],
  found: string[],
): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      if (typeof item === 'string' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(item)) {
        const [key, ...rest] = item.split('=');
        check(key, rest.join('='), `${path}[${index}]`, exemptions, found);
      } else {
        visit(item, `${path}[${index}]`, exemptions, found);
      }
    });
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;
      if (typeof value === 'string' || typeof value === 'number') {
        check(key, String(value), here, exemptions, found);
      } else {
        visit(value, here, exemptions, found);
      }
    }
  }
}

function check(
  key: string,
  value: string,
  where: string,
  exemptions: SecretExemption[],
  found: string[],
): void {
  const exempt = exemptions.some(e => e.key === key && e.value === value);
  if (exempt) return;
  if (SECRET_KEY.test(key) && !isSubstitutionOrEmpty(value)) {
    found.push(
      `NFR5.2: ${where} holds a literal value for a secret-like name.`,
    );
  } else if (ADDRESS_WITH_PASSWORD.test(value)) {
    found.push(`NFR5.2: ${where} holds an address with a password in it.`);
  }
}

/**
 * Walks a parsed YAML document and lists where a password, token, key or
 * connection string is written as a literal instead of a `${NAME}`
 * substitution (NFR5.2). Messages name the place, never the value. The
 * exemptions are a short named list of exact key and value pairs.
 */
export function findLiteralSecrets(
  doc: unknown,
  exemptions: SecretExemption[] = [],
): string[] {
  const found: string[] = [];
  visit(doc, '', exemptions, found);
  return found;
}
