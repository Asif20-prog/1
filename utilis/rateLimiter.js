class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.limit = 10; // Max requests per minute per IP
        this.interval = 60000; // 1 minute
    }

    allowRequest(req) {
        const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        const now = Date.now();

        if (!this.requests.has(ip)) {
            this.requests.set(ip, []);
        }

        const timestamps = this.requests.get(ip);
        const recentRequests = timestamps.filter(ts => now - ts < this.interval);
        
        if (recentRequests.length >= this.limit) {
            return false;
        }

        recentRequests.push(now);
        this.requests.set(ip, recentRequests);
        return true;
    }
}

export default new RateLimiter();
