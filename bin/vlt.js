#!/usr/bin/env node
// bin/vlt.js
// vlt — A local-first secret vault for developers.
// Because that API key was shown to you once, and once only.

'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const boxen = require('boxen');
const figlet = require('figlet');
const ora = require('ora');
const clipboardy = require('clipboardy');
const { table } = require('table');
const readline = require('readline');

const {
  initVault,
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
} = require('../src/store/vault');

const { promptPassword, promptPasswordConfirm } = require('../src/cli/prompt');

// ─── Persona ────────────────────────────────────────────────────────────────
const SARDONIC_LINES = [
  "Welcome back. The secrets are still secret. You're welcome.",
  "Vault open. No one saw that. Except us. But we're encrypted.",
  "Ah, you remember your password. A rare skill among developers.",
  "All keys accounted for. Unlike that one Stripe key from 2022.",
  "Your secrets are safe. Unlike your git history.",
  "Still here. Still encrypted. Still judging your variable names.",
  "Unlocked. Try not to commit this to GitHub.",
  "Back again. The vault missed you. Or it would, if it had feelings.",
  "All good here. Unlike your .env file from the last project.",
  "Ready. The keys are safe. Your deadlines, however, are your problem.",
  "Open sesame. But encrypted. And without the sesame.",
  "Vault unlocked. Please don't paste anything into Slack.",
  "Still not on the cloud. Still not your problem when AWS goes down.",
  "Keys loaded. No, you can't see them without the password. That was the whole point.",
  "Secured. Unlike that time you shared your screen during a demo.",
  "Access granted. We'd say we missed you but we don't store your feelings either.",
  "Everything in order. Your Supabase URL is still here. Unlike your project deadline.",
  "Decrypted. Don't screenshot this. Actually, don't screenshot anything.",
];

function randomSarcasm() {
  return SARDONIC_LINES[Math.floor(Math.random() * SARDONIC_LINES.length)];
}

function banner() {
  console.log(chalk.cyan(figlet.textSync('vlt', { font: 'Big' })));
  console.log(chalk.dim('  A vault for secrets. Because you only get to see them once.\n'));
}

function success(msg) {
  console.log(chalk.green('  ✓ ') + msg);
}

function warn(msg) {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

function error(msg) {
  console.log(chalk.red('  ✗ ') + msg);
}

function info(msg) {
  console.log(chalk.cyan('  → ') + msg);
}

function handleError(err) {
  if (err.message === 'NO_VAULT') {
    error("No vault found. Run `vlt init` to create one.");
    info("We know — first time for everything.");
  } else if (err.message === 'WRONG_PASSWORD') {
    error("Wrong password. The vault remains closed.");
    warn("If you forgot it, we genuinely cannot help you. That was the point.");
  } else if (err.message === 'VAULT_EXISTS') {
    error("A vault already exists at ~/.vlt/");
    info("Run `vlt info` to see where it lives.");
  } else {
    error(err.message);
  }
  process.exit(1);
}

// ─── Commands ────────────────────────────────────────────────────────────────

program
  .name('vlt')
  .description('A local-first secret vault for developers.')
  .version('1.0.0');

// ── init ──
program
  .command('init')
  .description('Initialize a new vault with a master password')
  .action(async () => {
    banner();

    if (vaultExists()) {
      warn("A vault already exists. We respect the commitment.");
      const { vaultFile } = getVaultInfo();
      info(`Location: ${vaultFile}`);
      info("To start fresh, delete ~/.vlt/ and run `vlt init` again.");
      return;
    }

    console.log(chalk.bold('\nCreating your vault.\n'));
    console.log(chalk.dim("Choose a strong master password. We cannot recover it."));
    console.log(chalk.dim("This is not a threat. It's a feature.\n"));

    try {
      const password = await promptPasswordConfirm();
      const spinner = ora('Encrypting vault...').start();
      initVault(password);
      spinner.succeed('Vault created.');

      console.log('');
      console.log(boxen(
        chalk.green.bold('✓ Vault ready.\n\n') +
        chalk.white('Your vault lives at ') + chalk.cyan('~/.vlt/') + '\n' +
        chalk.white('It is encrypted with AES-256-GCM.\n') +
        chalk.dim('\nNext steps:\n') +
        chalk.white('  vlt add myproject SUPABASE_URL https://...\n') +
        chalk.white('  vlt list\n') +
        chalk.white('  vlt copy myproject SUPABASE_URL'),
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      ));
    } catch (err) {
      handleError(err);
    }
  });

// ── add ──
program
  .command('add <project> <key> [value]')
  .description('Add or update a secret (value can be piped or prompted)')
  .option('-p, --prompt', 'prompt for value securely (default if no value given)')
  .action(async (project, key, value, opts) => {
    try {
      const password = await promptPassword('Master password: ');

      let secretValue = value;

      if (!secretValue) {
        // Prompt securely
        secretValue = await promptPassword(`Value for ${key}: `);
      }

      if (!secretValue || secretValue.trim() === '') {
        error("Value cannot be empty. That would defeat the purpose.");
        process.exit(1);
      }

      const spinner = ora('Encrypting...').start();
      setSecret(password, project, key, secretValue.trim());
      spinner.succeed(`Saved ${chalk.cyan(key)} → project ${chalk.yellow(project)}`);

      console.log(chalk.dim(`\n  ${randomSarcasm()}`));
    } catch (err) {
      handleError(err);
    }
  });

// ── get ──
program
  .command('get <project> <key>')
  .description('Print a secret value to stdout')
  .action(async (project, key) => {
    try {
      const password = await promptPassword('Master password: ');
      const value = getSecret(password, project, key);
      // Raw output — pipeable
      process.stdout.write(value + '\n');
    } catch (err) {
      handleError(err);
    }
  });

// ── copy ──
program
  .command('copy <project> <key>')
  .alias('cp')
  .description('Copy a secret to your clipboard (never touches stdout)')
  .action(async (project, key) => {
    try {
      const password = await promptPassword('Master password: ');
      const value = getSecret(password, project, key);
      await clipboardy.write(value);
      success(`${chalk.cyan(key)} copied to clipboard.`);
      info("Paste fast. We're not clearing your clipboard.");
    } catch (err) {
      handleError(err);
    }
  });

// ── list ──
program
  .command('list [project]')
  .alias('ls')
  .description('List projects or keys within a project')
  .action(async (project) => {
    try {
      const password = await promptPassword('Master password: ');

      if (!project) {
        const projects = listProjects(password);

        if (projects.length === 0) {
          info("No projects yet. Add one with `vlt add <project> <key> <value>`");
          return;
        }

        console.log('');
        console.log(chalk.bold('  Projects in vault:\n'));
        for (const p of projects) {
          const keys = listProjectKeys(password, p);
          console.log(`  ${chalk.yellow('◆')} ${chalk.white(p)} ${chalk.dim(`(${keys.length} secret${keys.length !== 1 ? 's' : ''})`)}`);
        }
        console.log('');
        info(`${projects.length} project${projects.length !== 1 ? 's' : ''} total. Run \`vlt list <project>\` to see keys.`);
      } else {
        const keys = listProjectKeys(password, project);

        if (keys.length === 0) {
          info(`Project "${project}" is empty.`);
          return;
        }

        console.log('');
        console.log(chalk.bold(`  Secrets in ${chalk.yellow(project)}:\n`));

        const tableData = [
          [chalk.dim('KEY'), chalk.dim('ADDED'), chalk.dim('UPDATED')],
          ...keys.map(({ key, added, updated }) => [
            chalk.cyan(key),
            chalk.dim(new Date(added).toLocaleDateString()),
            chalk.dim(new Date(updated).toLocaleDateString())
          ])
        ];

        console.log(table(tableData, {
          border: {
            topBody: chalk.dim('─'),
            topJoin: chalk.dim('┬'),
            topLeft: chalk.dim('┌'),
            topRight: chalk.dim('┐'),
            bottomBody: chalk.dim('─'),
            bottomJoin: chalk.dim('┴'),
            bottomLeft: chalk.dim('└'),
            bottomRight: chalk.dim('┘'),
            bodyLeft: chalk.dim('│'),
            bodyRight: chalk.dim('│'),
            bodyJoin: chalk.dim('│'),
            joinBody: chalk.dim('─'),
            joinLeft: chalk.dim('├'),
            joinRight: chalk.dim('┤'),
            joinJoin: chalk.dim('┼')
          }
        }));
      }

      console.log(chalk.dim(`  ${randomSarcasm()}`));
    } catch (err) {
      handleError(err);
    }
  });

// ── delete ──
program
  .command('delete <project> [key]')
  .alias('rm')
  .description('Delete a key or an entire project')
  .action(async (project, key) => {
    try {
      const password = await promptPassword('Master password: ');

      if (key) {
        deleteSecret(password, project, key);
        success(`Deleted ${chalk.cyan(key)} from ${chalk.yellow(project)}.`);
      } else {
        warn(`This will delete the entire project "${project}" and all its secrets.`);

        // Confirm
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => {
          rl.question('  Type the project name to confirm: ', (ans) => {
            rl.close();
            resolve(ans);
          });
        });

        if (answer.trim() !== project) {
          error("Names don't match. Cancelled. Your secrets live to see another day.");
          return;
        }

        deleteProject(password, project);
        success(`Project "${project}" deleted.`);
        warn("Unlike API keys, we can't regenerate that for you.");
      }
    } catch (err) {
      handleError(err);
    }
  });

// ── env ──
program
  .command('env <project>')
  .description('Print all secrets as .env format (pipe to a file)')
  .option('-o, --output <file>', 'write directly to a file (e.g. .env)')
  .option('-a, --append', 'append to file instead of overwriting')
  .action(async (project, opts) => {
    try {
      const password = await promptPassword('Master password: ');
      const secrets = exportProject(password, project);
      const keys = Object.keys(secrets);

      if (keys.length === 0) {
        warn(`Project "${project}" has no secrets.`);
        return;
      }

      const envContent = Object.entries(secrets)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';

      if (opts.output) {
        const fs = require('fs');
        const flag = opts.append ? 'a' : 'w';

        if (opts.append && fs.existsSync(opts.output)) {
          fs.appendFileSync(opts.output, '\n# vlt: ' + project + '\n' + envContent);
        } else {
          fs.writeFileSync(opts.output, '# vlt: ' + project + '\n' + envContent, { flag, mode: 0o600 });
        }

        success(`Wrote ${keys.length} secret${keys.length !== 1 ? 's' : ''} to ${chalk.cyan(opts.output)}`);
        warn("Don't commit that file. We'll know.");
      } else {
        // Pipe-friendly raw output
        process.stdout.write(envContent);
      }
    } catch (err) {
      handleError(err);
    }
  });

// ── import ──
program
  .command('import <project> <file>')
  .description('Import secrets from an existing .env file into a project')
  .action(async (project, file) => {
    try {
      const fs = require('fs');

      if (!fs.existsSync(file)) {
        error(`File not found: ${file}`);
        process.exit(1);
      }

      const password = await promptPassword('Master password: ');
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

      let count = 0;
      for (const line of lines) {
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key) {
          setSecret(password, project, key, value);
          count++;
        }
      }

      success(`Imported ${count} secret${count !== 1 ? 's' : ''} into project ${chalk.yellow(project)}.`);
      info("The .env file still exists. Consider deleting it.");
      warn("Or don't. We're a vault, not your conscience.");
    } catch (err) {
      handleError(err);
    }
  });

// ── passwd ──
program
  .command('passwd')
  .description('Change the master password (re-encrypts everything)')
  .action(async () => {
    try {
      warn("Changing master password re-encrypts your entire vault.");
      info("Make sure you remember the new one. We mean it.\n");

      const oldPassword = await promptPassword('Current master password: ');
      const newPassword = await promptPasswordConfirm();

      const spinner = ora('Re-encrypting vault...').start();
      changeMasterPassword(oldPassword, newPassword);
      spinner.succeed('Master password changed. All secrets re-encrypted.');

      warn("The old password no longer works. Commit that to memory.");
    } catch (err) {
      handleError(err);
    }
  });

// ── info ──
program
  .command('info')
  .description('Show vault location and status')
  .action(() => {
    const { dir, vaultFile, exists } = getVaultInfo();

    console.log('');
    console.log(chalk.bold('  vlt vault info\n'));
    info(`Location:   ${chalk.cyan(dir)}`);
    info(`Status:     ${exists ? chalk.green('Initialized') : chalk.red('Not initialized')}`);
    info(`Vault file: ${chalk.dim(vaultFile)}`);
    console.log('');

    if (exists) {
      info("Backup tip: copy ~/.vlt/ to a secure location.");
      info("The vault file is encrypted and useless without your password.");
    } else {
      info("Run `vlt init` to create your vault.");
    }
  });

// ── ui ──
program
  .command('ui')
  .description('Launch local web dashboard at http://localhost:6174')
  .action(async () => {
    const { startUI, PORT } = require('../src/ui/server');
    const open = require('open');

    try {
      const password = await promptPassword('Master password: ');

      // Validate by opening vault
      const { openVault } = require('../src/store/vault');
      openVault(password); // throws if wrong

      const server = startUI(password);

      console.log('');
      console.log(boxen(
        chalk.cyan.bold('✦ vlt dashboard\n\n') +
        chalk.white('Running at ') + chalk.cyan(`http://localhost:${PORT}`) + '\n' +
        chalk.dim('\nAll data stays local. No network calls.\n') +
        chalk.dim('Press Ctrl+C to stop.'),
        { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
      ));

      await open(`http://localhost:${PORT}`);

      // Keep alive
      process.on('SIGINT', () => {
        server.close();
        console.log('\n  Dashboard closed.');
        process.exit(0);
      });
    } catch (err) {
      handleError(err);
    }
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  banner();
  program.help();
}
