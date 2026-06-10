import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const PORT: number = parseInt(process.env.MOCK_PORT || '3000', 10);
const USERS_FILE_PATH: string =
  process.env.MOCK_USERS_FILE || path.resolve(process.cwd(), 'tests/data/authorized-users.txt');
const TOKEN_TTL_SECONDS: number = parseInt(process.env.MOCK_TOKEN_TTL_SECONDS || '3600', 10);

type MockUser = { username: string; password: string };
type TokenEntry = { username: string; expiresAt: number };

const users: MockUser[] = loadUsers(USERS_FILE_PATH);
const tokenStore: Map<string, TokenEntry> = new Map();

const app: Express = express();
app.use(cors());
app.use(express.json());

function loadUsers(filePath: string): MockUser[] {
  if (!existsSync(filePath)) {
    console.warn(`[mock] Users file not found at ${filePath}; using fallback demo user`);
    return [{ username: 'demo', password: 'demo' }];
  }

  const content: string = readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && !line.startsWith('#'))
    .map((line: string) => {
      const [username, password] = line.split(/[:;,]/).map((part: string) => part.trim());
      return { username, password };
    })
    .filter(
      (user: { username: string; password: string }): boolean => Boolean(user.username) && Boolean(user.password)
    );
}

function issueToken(username: string): string {
  const token: string = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString('base64url');
  tokenStore.set(token, { username, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
  return token;
}

function getBearerToken(req: Request): string | null {
  const authorization: string | undefined = req.header('authorization') || req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

function isTokenValid(token: string): boolean {
  const entry: TokenEntry | undefined = tokenStore.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return false;
  }
  return true;
}

function authenticateRequest(req: Request, res: Response): MockUser | null {
  const token: string | null = getBearerToken(req);
  if (!token || !isTokenValid(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const entry: TokenEntry = tokenStore.get(token)!;
  return users.find((user: MockUser): boolean => user.username === entry.username) ?? null;
}

function calcHandler(operation: string, fn: (a: number, b: number) => number, requiresAuth: boolean = false) {
  return (req: Request, res: Response) => {
    if (requiresAuth) {
      const authenticatedUser: MockUser | null = authenticateRequest(req, res);
      if (!authenticatedUser) {
        return;
      }
    }

    const { a, b } = req.body;

    if (a === undefined || b === undefined) {
      return res.status(400).json({
        result: 0,
        operation,
        error: 'Missing required fields "a" and "b"',
      });
    }

    const numA: number = typeof a === 'number' ? a : parseFloat(a);
    const numB: number = typeof b === 'number' ? b : parseFloat(b);

    if (isNaN(numA) || isNaN(numB)) {
      return res.status(400).json({
        result: 0,
        operation,
        error: 'Fields "a" and "b" must be valid numbers',
      });
    }

    res.json({ result: fn(numA, numB), operation });
  };
}

app.post('/oauth/token', (req: Request, res: Response) => {
  const { grant_type, client_id, username, password } = req.body ?? {};

  if (grant_type !== 'password') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!client_id || !username || !password) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const user: MockUser | undefined = users.find(
    (candidate: MockUser): boolean => candidate.username === username && candidate.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'invalid_grant' });
  }

  const access_token: string = issueToken(user.username);
  return res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
    scope: 'calc',
  });
});

app.post(
  '/api/calc/add',
  calcHandler('add', (a: number, b: number): number => a + b, false)
);
app.post(
  '/api/calc/multiply',
  calcHandler('multiply', (a: number, b: number): number => a * b, false)
);
app.post(
  '/authorized/api/calc/add',
  calcHandler('add', (a: number, b: number): number => a + b, true)
);
app.post(
  '/authorized/api/calc/multiply',
  calcHandler('multiply', (a: number, b: number): number => a * b, true)
);

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const shutdown: (code: number) => void = (code: number): never => {
  console.log(`[mock] Shutting down (code: ${code})`);
  process.exit(code);
};

const gracefulShutdown: (signal: string) => void = (signal: string): void => {
  console.log(`[mock] Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close((): void => {
      shutdown(0);
    });
    setTimeout(shutdown, 1000);
  } else {
    shutdown(0);
  }
};

process.on('SIGTERM', (): void => gracefulShutdown('SIGTERM'));
process.on('SIGINT', (): void => gracefulShutdown('SIGINT'));

const server = app.listen(PORT, () => {
  console.log(`[mock] Mock server running at http://localhost:${PORT}`);
  console.log(`[mock] OAuth token:   POST http://localhost:${PORT}/oauth/token`);
  console.log(`[mock] Calc ADD:      POST http://localhost:${PORT}/api/calc/add`);
  console.log(`[mock] Calc MULTIPLY: POST http://localhost:${PORT}/api/calc/multiply`);
  console.log(`[mock] Auth ADD:      POST http://localhost:${PORT}/authorized/api/calc/add`);
  console.log(`[mock] Auth MULTIPLY: POST http://localhost:${PORT}/authorized/api/calc/multiply`);
  console.log(`[mock] Health:        GET  http://localhost:${PORT}/health`);
});

export { app, server };
