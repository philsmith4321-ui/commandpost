module.exports = {
  apps: [{
    name: 'commandpost',
    script: 'node_modules/.bin/next',
    args: 'start -p 3004',
    cwd: '/var/www/commandpost',
    env_file: '.env',
    max_memory_restart: '512M',
  }]
}
