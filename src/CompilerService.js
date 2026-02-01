const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

class CompilerService {
    constructor() {
        this.CONTAINER_NAME = 'code_collab_worker';
        this.IMAGE_NAME = 'code_collab_image';
        this.initDocker();
    }

    initDocker() {
        // Check if container exists and is running
        exec(`docker ps --filter "name=${this.CONTAINER_NAME}" --format "{{.Names}}"`, (err, stdout) => {
            if (stdout.trim() !== this.CONTAINER_NAME) {
                console.log('Worker container not found. Initializing...');
                this.setupContainer();
            } else {
                console.log('Worker container is running.');
            }
        });
    }

    setupContainer() {
        // 1. Build Image (This might take time on first run, but happens in background)
        // We assume image is built or we build it now. 
        // ideally user should run "docker build -t code_collab_image ."
        
        exec(`docker inspect --type=image ${this.IMAGE_NAME}`, (err) => {
            if (err) {
                console.log('Image not found. Building...');
                // Build synchronously would block server. We'll utilize existing generic images if build fails,
                // but let's try to trigger build or just run.
                // For this V3, we will Assume the image is built or we use a basic ubuntu and install on fly? No, too slow.
                // We will try to run the container. If image missing, it will fail.
            }
        });

        // 2. Run Container (Persistent)
        // Check if stopped container exists
        exec(`docker ps -a --filter "name=${this.CONTAINER_NAME}" --format "{{.Names}}"`, (err, stdout) => {
            if (stdout.trim() === this.CONTAINER_NAME) {
                // Restart it
                exec(`docker start ${this.CONTAINER_NAME}`);
            } else {
                // Create and run
                // We mount a temp host directory to share files easily
                const hostTempDir = path.join(os.tmpdir(), 'code_collab_shared');
                if (!fs.existsSync(hostTempDir)) fs.mkdirSync(hostTempDir, { recursive: true });

                const dockerCmd = `docker run -d --name ${this.CONTAINER_NAME} -v "${hostTempDir}:/app/temp" ${this.IMAGE_NAME}`;
                
                exec(dockerCmd, (error) => {
                    if (error) {
                         // Fallback: If custom image not built, try running plain ubuntu and install updates? Too complex.
                        console.error('Failed to start worker container. Make sure to run: docker build -t code_collab_image .');
                    } else {
                        console.log('Worker container started successfully.');
                    }
                });
            }
        });
    }

    async execute(language, code) {
        return new Promise(async (resolve, reject) => {
            const jobId = uuidv4();
            const hostTempDir = path.join(os.tmpdir(), 'code_collab_shared');
            // Ensure shared dir exists
            if (!fs.existsSync(hostTempDir)) fs.mkdirSync(hostTempDir, { recursive: true });
            
            // Create job specific directory inside shared folder
            const jobDir = path.join(hostTempDir, jobId);
            fs.mkdirSync(jobDir);

            let fileName = '';
            let command = '';

            switch (language) {
                case 'python':
                    fileName = 'main.py';
                    command = `python3 /app/temp/${jobId}/${fileName}`;
                    break;
                case 'javascript':
                case 'node':
                    fileName = 'main.js';
                    command = `node /app/temp/${jobId}/${fileName}`;
                    break;
                case 'cpp':
                    fileName = 'main.cpp';
                    command = `g++ /app/temp/${jobId}/${fileName} -o /app/temp/${jobId}/output && /app/temp/${jobId}/output`;
                    break;
                case 'java':
                    fileName = 'Main.java';
                    command = `javac /app/temp/${jobId}/${fileName} && java -cp /app/temp/${jobId} Main`;
                    break;
                default:
                    // Cleanup
                    cleanup();
                    reject('Unsupported language: ' + language);
                    return;
            }

            // Write code to file on HOST (which is mounted to container)
            try {
                fs.writeFileSync(path.join(jobDir, fileName), code);
            } catch (err) {
                cleanup();
                reject('File write error: ' + err.message);
                return;
            }

            // Execute in Container
            // We use 'docker exec' to run the command inside the running container
            const dockerArgs = [
                'exec',
                this.CONTAINER_NAME,
                'sh', '-c', 
                command
            ];

            const process = spawn('docker', dockerArgs);

            let stdout = '';
            let stderr = '';
            let isTimedOut = false;

            const timer = setTimeout(() => {
                isTimedOut = true;
                process.kill();
                cleanup();
                resolve({ 
                    output: '', 
                    error: 'Execution timed out',
                    status: 'timeout' 
                });
            }, 10000);

            process.stdout.on('data', (data) => { stdout += data.toString(); });
            process.stderr.on('data', (data) => { stderr += data.toString(); });

            process.on('close', (code) => {
                clearTimeout(timer);
                if (isTimedOut) return;
                cleanup();
                
                if (code === 0) {
                    resolve({ output: stdout, error: stderr, status: 'success' });
                } else {
                    resolve({ output: stdout, error: stderr, status: 'error' });
                }
            });

            process.on('error', (err) => {
                clearTimeout(timer);
                cleanup();
                reject('Docker exec failure: ' + err.message);
            });

            function cleanup() {
                try {
                    // Cleanup host files
                    fs.rmSync(jobDir, { recursive: true, force: true });
                } catch (e) {
                    console.error('Cleanup error:', e);
                }
            }
        });
    }
}

module.exports = new CompilerService();
