#!/usr/bin/env python3
"""
vlt-inject — Python automation script for the vlt vault.

Usage:
  python vlt-inject.py                    # Auto-detects project, injects .env
  python vlt-inject.py --project myapp   # Specify project name
  python vlt-inject.py --list            # List available projects
  python vlt-inject.py --check           # Check if .env is in .gitignore

Requires: vlt CLI installed (npm install -g vlt-keys)
"""

import os
import sys
import json
import subprocess
import getpass
import argparse
import platform
import pathlib
from typing import Optional, Dict, List


# ─── Config ──────────────────────────────────────────────────────────────────

VAULT_DIR = pathlib.Path.home() / '.vlt'
VAULT_FILE = VAULT_DIR / 'vault.enc'
META_FILE = VAULT_DIR / 'meta.json'

SARCASTIC_INJECT = [
    "Injecting secrets. Don't tell anyone.",
    ".env written. Now try not to push it to GitHub.",
    "Keys delivered. The vault is locked again.",
    "Done. Those keys were only meant to be seen once, you know.",
    "Injected. Your project can breathe again.",
]

import random
import hashlib
import hmac
import base64
import struct


# ─── Pure Python crypto (no external deps) ───────────────────────────────────
# We use Python's built-in hashlib + secrets for PBKDF2 + AES via ctypes fallback.
# To avoid requiring pycryptodome, we call the vault through the Node CLI for
# decryption and use Python purely for orchestration + .env writing.
#
# If you want pure-Python decryption, install: pip install cryptography
# Then uncomment the crypto section below.


def check_vlt_installed() -> bool:
    """Check if the vlt CLI is installed."""
    try:
        result = subprocess.run(['vlt', '--version'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def detect_project_name(directory: pathlib.Path) -> Optional[str]:
    """
    Auto-detect project name from the directory.
    Checks: package.json, pyproject.toml, Cargo.toml, .git remote, directory name.
    """
    # 1. package.json
    pkg = directory / 'package.json'
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            name = data.get('name', '').strip()
            if name and name != 'undefined':
                return name
        except Exception:
            pass

    # 2. pyproject.toml (simple parse)
    pypkg = directory / 'pyproject.toml'
    if pypkg.exists():
        for line in pypkg.read_text().splitlines():
            if line.startswith('name'):
                parts = line.split('=')
                if len(parts) == 2:
                    return parts[1].strip().strip('"\'')

    # 3. Cargo.toml
    cargo = directory / 'Cargo.toml'
    if cargo.exists():
        for line in cargo.read_text().splitlines():
            if line.startswith('name'):
                parts = line.split('=')
                if len(parts) == 2:
                    return parts[1].strip().strip('"\'')

    # 4. Git remote origin name
    try:
        result = subprocess.run(
            ['git', 'remote', 'get-url', 'origin'],
            capture_output=True, text=True, cwd=directory
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            # Extract repo name from URL
            name = url.rstrip('/').split('/')[-1]
            name = name.replace('.git', '').strip()
            if name:
                return name
    except Exception:
        pass

    # 5. Directory name as fallback
    return directory.name


def get_project_list_from_vault(password: str) -> List[str]:
    """Get list of projects from vault using vlt CLI."""
    # We use a pipe-safe approach: vlt ls outputs project names
    # Capture output
    env = os.environ.copy()
    try:
        # Feed password via stdin through expect-like approach
        proc = subprocess.Popen(
            ['vlt', 'list'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(input=password + '\n', timeout=10)

        # Parse project names from output
        lines = stdout.splitlines()
        projects = []
        for line in lines:
            line = line.strip()
            # Lines with ◆ contain project names
            if '◆' in line or ('(') in line:
                # Clean ANSI codes
                import re
                clean = re.sub(r'\x1b\[[0-9;]*m', '', line)
                # Extract project name (first word after ◆)
                clean = clean.replace('◆', '').strip()
                name = clean.split('(')[0].strip()
                if name:
                    projects.append(name)
        return projects
    except Exception as e:
        return []


def export_project_to_env(password: str, project: str, output_path: pathlib.Path, append: bool = False) -> Dict[str, str]:
    """
    Use vlt CLI to export a project as .env format and write to file.
    Returns dict of key:value pairs exported.
    """
    try:
        proc = subprocess.Popen(
            ['vlt', 'env', project, '--output', str(output_path)] + (['--append'] if append else []),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(input=password + '\n', timeout=15)

        if proc.returncode != 0:
            # Try to extract error
            import re
            clean_err = re.sub(r'\x1b\[[0-9;]*m', '', stderr).strip()
            raise RuntimeError(clean_err or f"vlt exited with code {proc.returncode}")

        return True
    except subprocess.TimeoutExpired:
        raise RuntimeError("vlt command timed out")


def check_gitignore(directory: pathlib.Path) -> bool:
    """Check if .env is in .gitignore."""
    gitignore = directory / '.gitignore'
    if not gitignore.exists():
        return False
    content = gitignore.read_text()
    for line in content.splitlines():
        line = line.strip()
        if line in ['.env', '.env.*', '*.env']:
            return True
    return False


def add_to_gitignore(directory: pathlib.Path):
    """Add .env to .gitignore (creates if missing)."""
    gitignore = directory / '.gitignore'
    entry = '\n# vlt-inject: local secrets\n.env\n.env.local\n'
    if gitignore.exists():
        with open(gitignore, 'a') as f:
            f.write(entry)
    else:
        gitignore.write_text(entry)


def print_banner():
    print("\n" + "=" * 55)
    print("  vlt-inject — Secret Injector")
    print("  Because you only get to see that key once.")
    print("=" * 55 + "\n")


def print_success(msg):
    print(f"  ✓ {msg}")


def print_info(msg):
    print(f"  → {msg}")


def print_warn(msg):
    print(f"  ⚠  {msg}")


def print_error(msg):
    print(f"  ✗ {msg}", file=sys.stderr)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='vlt-inject: Inject secrets from vlt vault into a .env file',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python vlt-inject.py                         # Auto-detect project
  python vlt-inject.py --project mysupabaseapp # Specify project
  python vlt-inject.py --output .env.local     # Custom output file
  python vlt-inject.py --append                # Append to existing .env
  python vlt-inject.py --list                  # List vault projects
  python vlt-inject.py --check                 # Verify .gitignore safety
        """
    )
    parser.add_argument('--project', '-p', help='Vault project name (auto-detected if omitted)')
    parser.add_argument('--output', '-o', default='.env', help='Output file (default: .env)')
    parser.add_argument('--append', '-a', action='store_true', help='Append to output file')
    parser.add_argument('--list', '-l', action='store_true', help='List available vault projects')
    parser.add_argument('--check', '-c', action='store_true', help='Check .gitignore safety only')
    parser.add_argument('--dir', '-d', default='.', help='Project directory (default: current dir)')
    parser.add_argument('--skip-gitignore-check', action='store_true', help='Skip .gitignore safety check')
    parser.add_argument('--dry-run', action='store_true', help="Show what would be written without writing")

    args = parser.parse_args()

    print_banner()

    # ── Prereq: vlt installed ──
    if not check_vlt_installed():
        print_error("vlt CLI not found. Install it first:")
        print_info("  npm install -g vlt-keys")
        print_info("  (or: git clone + npm link in the vlt directory)")
        sys.exit(1)

    if not VAULT_FILE.exists():
        print_error("No vault found. Run: vlt init")
        sys.exit(1)

    project_dir = pathlib.Path(args.dir).resolve()

    # ── .gitignore check ──
    if args.check:
        is_safe = check_gitignore(project_dir)
        if is_safe:
            print_success(".env is in .gitignore — you're safe.")
        else:
            print_warn(".env is NOT in .gitignore.")
            print_info("Run with --check to add it, or add manually.")
        return

    # ── Auto-detect project name ──
    project_name = args.project

    if not project_name:
        detected = detect_project_name(project_dir)
        print_info(f"Auto-detected project: {detected}")
        confirm = input(f"  Use '{detected}'? [Y/n]: ").strip().lower()
        if confirm in ('n', 'no'):
            project_name = input("  Enter project name: ").strip()
        else:
            project_name = detected

    # ── Get password ──
    print()
    try:
        password = getpass.getpass("  Master vault password: ")
    except KeyboardInterrupt:
        print("\n  Cancelled.")
        sys.exit(0)

    # ── List mode ──
    if args.list:
        print_info("Fetching project list from vault...")
        projects = get_project_list_from_vault(password)
        if not projects:
            print_warn("No projects found, or password was wrong.")
        else:
            print(f"\n  Projects in vault:\n")
            for p in projects:
                print(f"    ◆ {p}")
            print()
        return

    # ── Safety: .gitignore check ──
    output_file = project_dir / args.output
    is_gitignore_safe = check_gitignore(project_dir)

    if not args.skip_gitignore_check and not is_gitignore_safe:
        print()
        print_warn(f"'{args.output}' is not in .gitignore!")
        print_warn("Committing secrets to Git is how careers end.")
        fix = input("  Add .env to .gitignore automatically? [Y/n]: ").strip().lower()
        if fix not in ('n', 'no'):
            add_to_gitignore(project_dir)
            print_success(".env added to .gitignore.")

    # ── Dry run ──
    if args.dry_run:
        print_info(f"DRY RUN — would write to: {output_file}")
        print_info(f"Project: {project_name}")
        print_info("No files written.")
        return

    # ── Export ──
    print()
    print_info(f"Exporting '{project_name}' → {args.output} ...")

    try:
        success = export_project_to_env(password, project_name, output_file, args.append)
        if success:
            # Set restrictive permissions on the .env file
            os.chmod(output_file, 0o600)

            print_success(f"Secrets written to {output_file}")
            print()
            print(f"  {random.choice(SARCASTIC_INJECT)}")
            print()
            print_info("The .env file is yours. The vault remains locked.")
            print_info("To overwrite later, just run this script again.")
        else:
            print_error("Export failed. Check project name and password.")
            sys.exit(1)

    except RuntimeError as e:
        err = str(e)
        if 'WRONG_PASSWORD' in err or 'wrong' in err.lower():
            print_error("Wrong password. The vault stays closed.")
            print_warn("That's the whole point, really.")
        elif 'not found' in err.lower():
            print_error(f"Project '{project_name}' not found in vault.")
            print_info("Run `vlt list` to see available projects.")
        else:
            print_error(f"Error: {err}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
