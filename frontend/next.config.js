const API = process.env.API_URL || 'http://localhost:3001';
module.exports = { async rewrites() { return [{ source: '/api/:path*', destination: `${API}/api/:path*` }]; } };
