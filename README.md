# vlt — A Secret Vault for Developers

> *"You'll only see that key once."*
> *— Every API platform, ever*

**vlt** is a local-first, zero-account, AES-256 encrypted secret vault for developers. Store your API keys, tokens, and secrets by project. Copy them when you need them. Never paste into a `.env` file manually again.

No cloud. No account. No subscription. Just your password.

---

## Why vlt?

- **Platforms show your key once.** You either saved it or you're deleting and regenerating — which breaks your Supabase URL vars, your Vercel envs, your CI pipeline.
- **1Password/Bitwarden are great** but they're not optimized for developer workflows (project-scoped keys, `.env` export, terminal-native).
- **Doppler/Infisical require accounts** and sync to the cloud. vlt doesn't.

---

## Install

```bash
git clone https://github.com/yourusername/vlt.git
cd vlt
npm install
npm link   # makes `vlt` available globally
```

**Requirements:** Node.js 16+

---

## Quick Start

```bash
# 1. Initialize your vault (once, ever)
vlt init

# 2. Add secrets to a project
vlt add myapp SUPABASE_URL https://xxxx.supabase.co
vlt add myapp SUPABASE_ANON_KEY eyJhbGciOiJIUzI1NiI...

# 3. List your projects / keys
vlt list
vlt list myapp

# 4. Copy a key to clipboard (never echoes to terminal)
vlt copy myapp SUPABASE_ANON_KEY

# 5. Export project as .env
vlt env myapp --output .env
```

---

## All Commands

| Command | Description |
|---|---|
| `vlt init` | Create a new vault (first time only) |
| `vlt add <project> <key> [value]` | Add/update a secret |
| `vlt get <project> <key>` | Print secret to stdout |
| `vlt copy <project> <key>` | Copy secret to clipboard |
| `vlt list` | List all projects |
| `vlt list <project>` | List all keys in a project |
| `vlt env <project>` | Export project as .env format |
| `vlt env <project> --output .env` | Write .env file directly |
| `vlt env <project> --append` | Append to existing .env |
| `vlt import <project> <file>` | Import from existing .env file |
| `vlt delete <project> <key>` | Delete a single secret |
| `vlt delete <project>` | Delete entire project |
| `vlt passwd` | Change master password |
| `vlt info` | Show vault location |

---

## Python Automation: `vlt-inject`

The `vlt-inject.py` script auto-detects your project name and writes a `.env` file. Great for CI setup scripts or new machine onboarding.

```bash
# Navigate to your project
cd ~/Projects/myapp

# Run the injector — auto-detects project name from package.json / git remote
python vlt-inject.py

# Or specify project name
python vlt-inject.py --project myapp

# Write to custom file
python vlt-inject.py --output .env.local

# Check if .env is safely in .gitignore
python vlt-inject.py --check

# List available vault projects
python vlt-inject.py --list
```

**Features:**
- Auto-detects project name from `package.json`, `pyproject.toml`, `Cargo.toml`, or git remote
- Automatically checks (and offers to fix) `.gitignore` before writing
- Sets `chmod 600` on the generated `.env`
- Sarcastic output, because you earned it

---

## Security

| Property | Detail |
|---|---|
| **Algorithm** | AES-256-GCM (authenticated encryption) |
| **Key derivation** | PBKDF2-SHA512, 100,000 iterations |
| **Storage** | `~/.vlt/` with `chmod 600` |
| **Per-secret encryption** | Each value encrypted individually |
| **Master password** | PBKDF2-SHA512 hash stored in meta file |
| **Recovery** | Impossible without the master password. That's intentional. |

**Vault location:** `~/.vlt/`
- `vault.enc` — encrypted vault data
- `meta.json` — version + password hash (no plaintext secrets)

**Backup:** Copy `~/.vlt/` to a USB drive or encrypted cloud folder. The vault file is useless without your password.

---

## The Philosophy

Every secret management platform will show you your API key once. Stripe, Supabase, OpenAI, Anthropic, Resend — once. You either saved it or you're deleting it and hoping nothing was using it.

vlt is the place you save it. Local. Encrypted. No account to lose, no cloud service to go down, no SaaS to start charging you.

---

## Multi-Machine Setup

1. Copy `~/.vlt/` from your old machine to `~` on the new one
2. Install vlt (`git clone` + `npm link`)
3. Your vault, passwords, and all secrets are there

---

## Project Structure

```
vlt/
├── bin/
│   └── vlt.js              # CLI entry point
├── src/
│   ├── crypto/
│   │   └── cipher.js       # AES-256-GCM encryption
│   ├── store/
│   │   └── vault.js        # Vault read/write/CRUD
│   └── cli/
│       └── prompt.js       # Secure password prompting
├── python/
│   └── vlt-inject.py       # Python automation script
├── package.json
└── README.md
```

---

## FAQ

**Q: What if I forget my master password?**
A: You're done. The vault cannot be decrypted without it. Write it down and store it somewhere safe (ironic for a secrets tool, we know).

**Q: Is this production-grade?**
A: It uses the same encryption (AES-256-GCM + PBKDF2) as industry tools. It is not audited. For enterprise secrets, use Vault by HashiCorp, Doppler, or AWS Secrets Manager.

**Q: Can I share the vault file with my team?**
A: Technically yes (copy `~/.vlt/vault.enc` and share the password out-of-band). But this tool is designed for solo developer use. For teams, add a team-oriented tool.

**Q: Why not just use `.env` files?**
A: Because you commit them. Everyone does. That's why we're here.

---

*vlt — The vault that doesn't apologize for not showing you the key twice.*
