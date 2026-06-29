const requests = new Map<string, number[]>();

export function rateLimit(ip: string) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 min
  const maxRequests = 5;

  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  const timestamps = requests.get(ip)!;

  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    return false;
  }

  recent.push(now);
  requests.set(ip, recent);

  return true;
}