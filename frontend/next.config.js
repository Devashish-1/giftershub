const API = process.env.API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://giftershub-api.onrender.com'
    : 'http://localhost:3001'
);
module.exports = {
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
};
