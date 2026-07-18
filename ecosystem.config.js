module.exports = {
  apps: [{
    name: 'commandpost',
    script: 'node_modules/.bin/next',
    // -H 127.0.0.1: nginx is the only sanctioned path to the app (it proxies to
    // 127.0.0.1:3004). Binding loopback means the basic-auth gates on /audible,
    // /api/audible/ and /api/backup cannot be bypassed via direct :3004 access,
    // regardless of droplet firewall state. PM2 caches args — after deploying
    // this change, run `pm2 startOrReload ecosystem.config.js` (not plain
    // restart) so it takes effect.
    args: 'start -p 3004 -H 127.0.0.1',
    cwd: '/var/www/commandpost',
    env_file: '.env',
    max_memory_restart: '512M',
  }]
}
