/**
 * One log line a minute with this process's memory and CPU, plus the exit code
 * when the process stops. No signal handlers: shutdown behaviour stays as is. The Timeweb console is often
 * unreachable, so the application log is the only view into an outage.
 */
let started = false;

const mb = (bytes: number) => Math.round(bytes / 1048576);

export function startRuntimeHealthLog(intervalMs = 60_000): void {
  if (started) return;
  started = true;
  let lastCpu = process.cpuUsage();
  let lastAt = Date.now();
  const timer = setInterval(() => {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(lastCpu);
    const elapsed = Date.now() - lastAt;
    lastCpu = process.cpuUsage();
    lastAt = Date.now();
    const cpuPercent = elapsed > 0 ? Math.round(((cpu.user + cpu.system) / 1000 / elapsed) * 100) : 0;
    console.log(`[runtime] rss=${mb(memory.rss)}MB heap=${mb(memory.heapUsed)}/${mb(memory.heapTotal)}MB external=${mb(memory.external)}MB buffers=${mb(memory.arrayBuffers)}MB cpu=${cpuPercent}% uptime=${Math.round(process.uptime())}s`);
  }, intervalMs);
  timer.unref?.();
  // Log only: never swallow a crash, the process must still stop as before.
  process.on('exit', (code) => {
    console.log(`[runtime] exit code=${code} after ${Math.round(process.uptime())}s, rss=${mb(process.memoryUsage().rss)}MB`);
  });
}
