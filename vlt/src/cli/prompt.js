// src/cli/prompt.js
// Secure password prompt — we don't echo, because we're not animals.

const readline = require('readline');

/**
 * Prompts for a password without echoing characters.
 * Works on Mac, Linux, and Windows.
 */
function promptPassword(promptText = 'Master password: ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(promptText);

    let password = '';

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (char) => {
      char = char.toString();

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
          break;
        case '\u007F': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(promptText + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Prompts for password twice and confirms they match.
 */
async function promptPasswordConfirm() {
  const p1 = await promptPassword('Choose master password: ');
  const p2 = await promptPassword('Confirm master password: ');

  if (p1 !== p2) {
    throw new Error('Passwords do not match.');
  }

  if (p1.length < 8) {
    throw new Error('Password must be at least 8 characters. Come on.');
  }

  return p1;
}

module.exports = { promptPassword, promptPasswordConfirm };
