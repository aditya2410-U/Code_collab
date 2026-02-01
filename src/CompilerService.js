const { spawn } = require('child_process');

class CompilerService {
    constructor() {
        this.TIMEOUT = 10000; // 10 seconds execution timeout
    }

    execute(language, code) {
        return new Promise((resolve, reject) => {
            let dockerImage = '';
            let command = [];

            switch (language) {
                case 'python':
                    dockerImage = 'python:3.10-slim';
                    command = ['python3'];
                    break;
                case 'javascript':
                case 'node':
                    dockerImage = 'node:18-alpine';
                    command = ['node'];
                    break;
                case 'cpp':
                    dockerImage = 'gcc:latest';
                    // C++ is trickier via stdin. We'll wrap it in a shell command to compile then run.
                    // Or simpler: compile and run one-liner if possible, but gcc produces a binary.
                    // For now, let's stick to interpreted languages or simple compile-run chains.
                    // Let's defer C++ to keep initial implementation robust for Python/JS.
                    reject('Language not supported yet: ' + language);
                    return;
                case 'java':
                    dockerImage = 'openjdk:17-alpine';
                     // Java is also tricky with class names. 
                     // We would need to write to a file like Main.java.
                     // Skipping for V1.
                    reject('Language not supported yet: ' + language);
                    return;
                default:
                    reject('Unsupported language: ' + language);
                    return;
            }

            // Docker arguments
            // --rm: remove container after exit
            // -i: interactive (keep stdin open)
            // --network none: fully isolated network
            // --memory 128m: limit memory
            // --cpus 0.5: limit cpu
            const dockerArgs = [
                'run',
                '--rm',
                '-i',
                '--network', 'none',
                '--memory', '128m',
                '--cpus', '0.5',
                dockerImage,
                ...command
            ];

            const process = spawn('docker', dockerArgs);

            let stdout = '';
            let stderr = '';
            let isTimedOut = false;

            // Timeout handling
            const timer = setTimeout(() => {
                isTimedOut = true;
                process.kill();
                resolve({ 
                    output: '', 
                    error: 'Execution timed out (limit: 10s)',
                    status: 'timeout' 
                });
            }, this.TIMEOUT);

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                clearTimeout(timer);
                if (isTimedOut) return;

                if (code === 0) {
                    resolve({ output: stdout, error: stderr, status: 'success' });
                } else {
                    resolve({ output: stdout, error: stderr, status: 'error' });
                }
            });

            process.on('error', (err) => {
                clearTimeout(timer);
                reject('Docker failure: ' + err.message);
            });

            // Write code to stdin
            try {
                process.stdin.write(code);
                process.stdin.end();
            } catch (e) {
                clearTimeout(timer);
                reject('Stream error: ' + e.message);
            }
        });
    }
}

module.exports = new CompilerService();
