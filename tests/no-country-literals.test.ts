import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', 'src');
const COUNTRY_DIR = path.join(SRC, 'lib', 'country');

/** Literales de país entre comillas: 'VE' "BR". No matchea 'VES' ni 'BRL'. */
const COUNTRY_LITERAL = /['"](VE|BR)['"]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

describe('Test 8 · El núcleo no conoce países', () => {
  it('ningún archivo fuera de src/lib/country/ contiene el literal de un país', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      if (file.startsWith(COUNTRY_DIR)) continue;

      const source = readFileSync(file, 'utf8');
      const matches = [...source.matchAll(COUNTRY_LITERAL)];
      if (matches.length > 0) {
        const found = [...new Set(matches.map((m) => m[0]))].join(', ');
        offenders.push(`${path.relative(SRC, file)} → ${found}`);
      }
    }

    expect(
      offenders,
      'La abstracción multipaís se rompió. Estos archivos codifican un país ' +
        'a mano en vez de pedírselo al CountryPack:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });
});
