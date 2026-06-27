// src/store/vault.js
// The actual vault. Encrypted at rest. JSON under the hood.
// Format: { __meta: { version, passwordHash }, projects: { projectName: { keyName: encryptedValue } } }

const fs = require('fs');
const path = require('path');
const os = require('os');
const { encrypt, decrypt, hashPassword, verifyPassword } = require('../crypto/cipher');

const VAULT_DIR = path.join(os.homedir(), '.vlt');
const VAULT_FILE = path.join(VAULT_DIR, 'vault.enc');
const META_FILE = path.join(VAULT_DIR, 'meta.json');

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

function vaultExists() {
  return fs.existsSync(VAULT_FILE) && fs.existsSync(META_FILE);
}

/**
 * Initialize a new vault with a master password.
 * Throws if vault already exists.
 */
function initVault(password) {
  ensureVaultDir();

  if (vaultExists()) {
    throw new Error('VAULT_EXISTS');
  }

  const meta = {
    version: '1.0.0',
    created: new Date().toISOString(),
    passwordHash: hashPassword(password)
  };

  const emptyVault = { projects: {} };
  const encrypted = encrypt(JSON.stringify(emptyVault), password);

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), { mode: 0o600 });
  fs.writeFileSync(VAULT_FILE, encrypted, { mode: 0o600 });

  return true;
}

/**
 * Load and decrypt the vault. Returns the vault object.
 * Throws WRONG_PASSWORD or NO_VAULT.
 */
function openVault(password) {
  if (!vaultExists()) {
    throw new Error('NO_VAULT');
  }

  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));

  if (!verifyPassword(password, meta.passwordHash)) {
    throw new Error('WRONG_PASSWORD');
  }

  const encrypted = fs.readFileSync(VAULT_FILE, 'utf8');
  const decrypted = decrypt(encrypted, password);
  return JSON.parse(decrypted);
}

/**
 * Save (re-encrypt) the vault with the master password.
 */
function saveVault(vault, password) {
  ensureVaultDir();
  const encrypted = encrypt(JSON.stringify(vault), password);
  fs.writeFileSync(VAULT_FILE, encrypted, { mode: 0o600 });
}

/**
 * Add or update a secret in a project.
 */
function setSecret(password, projectName, keyName, value) {
  const vault = openVault(password);

  if (!vault.projects[projectName]) {
    vault.projects[projectName] = {};
  }

  vault.projects[projectName][keyName] = {
    value: encrypt(value, password),
    added: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  saveVault(vault, password);
  return true;
}

/**
 * Get a decrypted secret value.
 */
function getSecret(password, projectName, keyName) {
  const vault = openVault(password);

  if (!vault.projects[projectName]) {
    throw new Error(`Project "${projectName}" not found in vault.`);
  }
  if (!vault.projects[projectName][keyName]) {
    throw new Error(`Key "${keyName}" not found in project "${projectName}".`);
  }

  const entry = vault.projects[projectName][keyName];
  return decrypt(entry.value, password);
}

/**
 * List all projects.
 */
function listProjects(password) {
  const vault = openVault(password);
  return Object.keys(vault.projects);
}

/**
 * List all keys in a project (without values).
 */
function listProjectKeys(password, projectName) {
  const vault = openVault(password);

  if (!vault.projects[projectName]) {
    throw new Error(`Project "${projectName}" not found.`);
  }

  return Object.entries(vault.projects[projectName]).map(([key, entry]) => ({
    key,
    added: entry.added,
    updated: entry.updated
  }));
}

/**
 * Delete a single secret.
 */
function deleteSecret(password, projectName, keyName) {
  const vault = openVault(password);

  if (!vault.projects[projectName] || !vault.projects[projectName][keyName]) {
    throw new Error(`Key "${keyName}" not found in project "${projectName}".`);
  }

  delete vault.projects[projectName][keyName];
  saveVault(vault, password);
  return true;
}

/**
 * Delete an entire project.
 */
function deleteProject(password, projectName) {
  const vault = openVault(password);

  if (!vault.projects[projectName]) {
    throw new Error(`Project "${projectName}" not found.`);
  }

  delete vault.projects[projectName];
  saveVault(vault, password);
  return true;
}

/**
 * Export all keys for a project as a plain object { KEY: value }
 * Used for .env generation.
 */
function exportProject(password, projectName) {
  const vault = openVault(password);

  if (!vault.projects[projectName]) {
    throw new Error(`Project "${projectName}" not found.`);
  }

  const result = {};
  for (const [key, entry] of Object.entries(vault.projects[projectName])) {
    result[key] = decrypt(entry.value, password);
  }
  return result;
}

/**
 * Change master password — re-encrypts everything.
 */
function changeMasterPassword(oldPassword, newPassword) {
  const vault = openVault(oldPassword); // validates old password

  // Re-encrypt every individual secret with new password
  for (const project of Object.values(vault.projects)) {
    for (const key of Object.keys(project)) {
      const plainValue = decrypt(project[key].value, oldPassword);
      project[key].value = encrypt(plainValue, newPassword);
      project[key].updated = new Date().toISOString();
    }
  }

  // Update meta with new password hash
  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  meta.passwordHash = hashPassword(newPassword);
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

  saveVault(vault, newPassword);
  return true;
}

/**
 * Get vault location info
 */
function getVaultInfo() {
  return {
    dir: VAULT_DIR,
    vaultFile: VAULT_FILE,
    metaFile: META_FILE,
    exists: vaultExists()
  };
}

module.exports = {
  initVault,
  openVault,
  setSecret,
  getSecret,
  listProjects,
  listProjectKeys,
  deleteSecret,
  deleteProject,
  exportProject,
  changeMasterPassword,
  getVaultInfo,
  vaultExists
};
