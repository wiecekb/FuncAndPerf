import express, {Express, Request, Response} from 'express';
import cors from 'cors';

const PORT: number = parseInt(process.env.MOCK_PORT || '3000', 10);

const app: Express = express();
app.use(cors());
app.use(express.json());

function calcHandler(operation: string, fn: (a: number, b: number) => number) {
    return (req: Request, res: Response) => {
        const {a, b} = req.body;

        if (a === undefined || b === undefined) {
            return res.status(400).json({
                result: 0,
                operation,
                error: 'Missing required fields "a" and "b"'
            });
        }

        const numA: number = typeof a === 'number' ? a : parseFloat(a);
        const numB: number = typeof b === 'number' ? b : parseFloat(b);

        if (isNaN(numA) || isNaN(numB)) {
            return res.status(400).json({
                result: 0,
                operation,
                error: 'Fields "a" and "b" must be valid numbers'
            });
        }

        res.json({result: fn(numA, numB), operation});
    };
}

app.post('/api/calc/add', calcHandler('add', (a: number, b: number): number => a + b));
app.post('/api/calc/multiply', calcHandler('multiply', (a: number, b: number): number => a * b));

app.get('/health', (_req: Request, res: Response):void => {
    res.json({status: 'ok', timestamp: new Date().toISOString()});
});

const server = app.listen(PORT, () => {
    console.log(`[mock] Mock server running at http://localhost:${PORT}`);
    console.log(`[mock] Calc ADD:      POST http://localhost:${PORT}/api/calc/add`);
    console.log(`[mock] Calc MULTIPLY: POST http://localhost:${PORT}/api/calc/multiply`);
    console.log(`[mock] Health:        GET  http://localhost:${PORT}/health`);
});

export {app, server};
