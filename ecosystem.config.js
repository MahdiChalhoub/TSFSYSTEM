module.exports = {
  apps: [{
    name: "tsf-frontend",
    script: "npm",
    args: "start",
    cwd: "/root/current",
    env: { PORT: 3000, NODE_ENV: "production" },
    max_restarts: 5,
    restart_delay: 2000,
  }]
};
