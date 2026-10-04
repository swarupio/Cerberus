const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const allowedServices = new Set(['gateway', 'user-service', 'order-service']);
const protectedServices = new Set(['prometheus', 'grafana']);
const usage = 'Usage: node chaos-tool/cli.js list | kill <service-or-container-name> [--restart-after <seconds>]';

function docker(args) {
  try {
    return execFileSync('docker', args, {
      cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(error.stderr?.toString().trim() || error.message);
  }
}

function parseArgs(args) {
  if (args.length === 1 && args[0] === 'list') return { command: 'list' };
  if (args[0] !== 'kill' || !args[1] || ![2, 4].includes(args.length)) {
    throw new Error(usage);
  }
  if (protectedServices.has(args[1])) throw new Error('Monitoring services are protected.');
  if (args.length === 4 && args[2] !== '--restart-after') throw new Error(usage);
  const seconds = args.length === 4 ? Number(args[3]) : 30;
  if (!args[3]?.trim() && args.length === 4) throw new Error('Missing restart delay.');
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) {
    throw new Error('Restart delay must be between 0 and 86400 seconds.');
  }
  return { command: 'kill', target: args[1], seconds };
}

function belongsToProject(container, project, directory = root) {
  const labels = container.Config?.Labels || {};
  const workingDir = labels['com.docker.compose.project.working_dir'];
  return labels['com.docker.compose.project'] === project
    && !!workingDir && path.resolve(workingDir) === path.resolve(directory);
}

function assertTarget(container, project, directory = root) {
  const labels = container.Config?.Labels || {};
  if (!belongsToProject(container, project, directory)) {
    throw new Error('Target does not belong to this Compose project and directory.');
  }
  const service = labels['com.docker.compose.service'];
  if (!allowedServices.has(service) || labels['com.docker.compose.oneoff']?.toLowerCase() !== 'false') {
    throw new Error('Protected target: only gateway, user-service, and order-service are allowed.');
  }
}

function selectTarget(containers, name, project, directory = root) {
  const matches = containers.filter(container => container.Name.slice(1) === name
    || container.Config.Labels['com.docker.compose.service'] === name);
  if (matches.length !== 1) throw new Error('Target must match exactly one running project container; use its exact name from list.');
  assertTarget(matches[0], project, directory);
  if (!matches[0].State.Running || matches[0].State.Paused) throw new Error('Target must be running and unpaused.');
  return matches[0];
}

function inspect(id) {
  return JSON.parse(docker(['inspect', '--type', 'container', id]))[0];
}

function log(message) {
  console.log(new Date().toISOString() + ' ' + message);
}

async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(usage);
    return;
  }
  const options = parseArgs(args);
  const config = JSON.parse(docker(['compose', '--project-directory', root,
    '--file', path.join(root, 'docker-compose.yml'), 'config', '--format', 'json']));
  const project = config.name;
  if (!project) throw new Error('Unable to determine Compose project name.');
  const ids = docker(['ps', '--filter', 'label=com.docker.compose.project=' + project,
    '--quiet', '--no-trunc']).split(/\s+/).filter(Boolean);
  const containers = ids.length ? JSON.parse(docker(['inspect', '--type', 'container', ...ids]))
    .filter(container => belongsToProject(container, project)) : [];
  if (options.command === 'list') {
    log('Running containers for project ' + project);
    for (const container of containers) {
      const service = container.Config.Labels['com.docker.compose.service'];
      let target = 'protected';
      try { assertTarget(container, project); target = 'allowed'; } catch {}
      console.log(container.Name.slice(1) + '\t' + service + '\t' + container.State.Status + '\t' + target);
    }
    if (!containers.length) console.log('No running project containers.');
    return;
  }
  const selected = selectTarget(containers, options.target, project);
  const container = inspect(selected.Id);
  assertTarget(container, project);
  if (!container.State.Running || container.State.Paused) throw new Error('Target is no longer running and unpaused.');
  const name = container.Name.slice(1);
  log('Killing ' + name + ' (' + container.Id.slice(0, 12) + ') with SIGKILL');
  docker(['kill', '--signal', 'SIGKILL', container.Id]);
  const controller = new AbortController();
  const interrupt = () => {
    log('Interrupted; restarting the target immediately.');
    controller.abort();
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const stopped = inspect(container.Id);
    if (stopped.State.Running) throw new Error('Container is still running after kill.');
    log('Stopped ' + name + ': status=' + stopped.State.Status + ', exitCode=' + stopped.State.ExitCode);
    log('Restart scheduled in ' + options.seconds + ' seconds.');
    await delay(options.seconds * 1000, undefined, { signal: controller.signal })
      .catch(error => { if (error.name !== 'AbortError') throw error; });
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    assertTarget(inspect(container.Id), project);
    docker(['start', container.Id]);
    const restarted = inspect(container.Id);
    if (!restarted.State.Running) throw new Error('Container did not restart.');
    log('Restarted ' + name + ': status=' + restarted.State.Status + ', running=' + restarted.State.Running);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    console.error('Chaos tool: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, assertTarget, selectTarget };
