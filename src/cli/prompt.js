// src/cli/prompt.js
// Secure password prompt — we don't echo, because we're not animals.
// Works on Mac, Linux, and Windows CMD/PowerShell.

const readline = require('readline');

/**
 * Prompts for a password without echoing characters.
 * On Windows CMD, readline's muted output mode is used as a fallback
 * since setRawMode is not available outside of a TTY/PTY.
 */
function promptPassword(promptText = 'Master password: ') {
  return new Promise((resolve, reject) => {

    // Windows CMD / non-TTY fallback: use readline with muted output
    // This hides input entirely rather than showing asterisks,
    // but is the most reliable cross-platform approach.
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Mute stdout while typing
      const _write = rl.output.write.bind(rl.output);
      rl.output.write = (s) => {
        // Allow the prompt text through, suppress echoed input
        if (s === promptText || s === '\n' || s === '\r\n') {
          return _write(s);
        }
      };

      rl.question(promptText, (answer) => {
        rl.output.write = _write; // restore
        rl.close();
        process.stdout.write('\n');
        resolve(answer);
      });

      return;
    }

    // Unix / Windows Terminal (TTY) — raw mode with asterisk masking
    process.stdout.write(promptText);

    let password = '';

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (char) => {
      char = char.toString();

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;

        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
          break;

        case '\u007F': // Backspace (Unix)
        case '\u0008': // Backspace (Windows)
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(promptText + '*'.repeat(password.length));
          }
          break;

        default:
          // On Windows TTY, filter out non-printable chars
          if (char.charCodeAt(0) >= 32) {
            password += char;
            process.stdout.write('*');
          }
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
