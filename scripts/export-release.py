#!/usr/bin/env python3
"""Create a source ZIP from an explicit reviewed allowlist. Never zip the whole working folder."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FORBIDDEN = {'keys', 'node_modules', '.git', '.next', 'target', '__pycache__', 'deliveries', 'uploads'}
SECRET = re.compile(rb'(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|["\'](?:privateKey|secretKey|private_key|secret_key)["\']\s*:\s*["\'][^"\']{16,}["\'])')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='New ZIP path, preferably outside the project')
    args = parser.parse_args()
    out = Path(args.output).expanduser().resolve()
    if out.exists():
        raise SystemExit('Refusing to overwrite existing output. Choose a new filename.')
    allow = json.loads((ROOT / 'config/release-files.json').read_text(encoding='utf-8'))['files']
    if len(allow) != len(set(allow)):
        raise SystemExit('Duplicate allowlist entries.')
    contents = {}
    for name in allow:
        rel = Path(name)
        if rel.is_absolute() or '..' in rel.parts or any(part in FORBIDDEN for part in rel.parts):
            raise SystemExit('Unsafe allowlist path: ' + name)
        if rel.name.startswith('.env') and rel.name != '.env.example':
            raise SystemExit('Environment secret path refused: ' + name)
        p = ROOT / rel
        if any(x.is_symlink() for x in [p, *p.parents] if x != ROOT.parent):
            raise SystemExit('Symlink refused: ' + name)
        if not p.resolve().is_relative_to(ROOT) or not p.is_file():
            raise SystemExit('Missing/invalid release file: ' + name)
        data = p.read_bytes()
        if p.suffix.lower() in {'.json', '.md', '.ts', '.tsx', '.js', '.mjs', '.py', '.yml', '.yaml', '.txt'}:
            if SECRET.search(data):
                raise SystemExit('Possible literal private credential found; inspect locally: ' + name)
        contents[name] = data
    # Manifest covers exact exported bytes. It does not claim a comprehensive secret audit.
    manifest = {'warning': 'Testnet prototype; see docs/THREAT_MODEL.md. Automated checks do not prove absence of secrets.',
                'files': [{'path': n, 'sha256': hashlib.sha256(d).hexdigest()} for n, d in sorted(contents.items())]}
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(out, 'x', zipfile.ZIP_DEFLATED) as z:
            for name, data in sorted(contents.items()):
                z.writestr(name, data)
            z.writestr('RELEASE-MANIFEST.json', json.dumps(manifest, indent=2))
        with zipfile.ZipFile(out) as z:
            if z.testzip() is not None:
                raise RuntimeError('ZIP integrity check failed')
    except Exception:
        if out.exists(): out.unlink()
        raise
    print(f'Created {out}: {len(contents)} allowlisted files plus RELEASE-MANIFEST.json')
    print('SHA-256:', hashlib.sha256(out.read_bytes()).hexdigest())
    print('Keys, actual .env files, dependencies and build folders are not included.')
    print('Inspect the ZIP before sharing: allowlisting and pattern scanning cannot guarantee no secrets.')
    print('Export does not rotate exposed keys, deploy anything, or certify production readiness.')

if __name__ == '__main__':
    main()
