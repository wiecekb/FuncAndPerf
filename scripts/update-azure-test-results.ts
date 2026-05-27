import * as fs from 'fs';
import * as https from 'https';

const PARSED_RESULTS_FILE = 'test-results-parsed.json';

interface ParsedTestResult {
    name: string;
    azureTestCaseId: number;
    status: 'passed' | 'fail' | 'skipped';
    duration: number;
    errorMessage: string | null;
}

interface ApiResponse<T = unknown> {
    status: number | undefined;
    data: T;
}

interface TestPointInfo {
    pointId: string;
    testCaseName: string;
}

interface TestCasePoint {
    testCaseId: string;
    pointId: string;
    testCaseName: string;
}

interface AzureTestPointResponse {
    value?: Array<{
        id: string;
        testCase: {
            id: string;
            name: string;
        };
    }>;

    [key: string]: unknown;
}

interface AzureWorkItemResponse {
    fields?: Record<string, unknown>;
    rev?: number;

    [key: string]: unknown;
}

interface AzureTestRunResponse {
    id: number;

    [key: string]: unknown;
}

interface AzureTestResultAddResponse {
    count?: number;
    length?: number;

    [key: string]: unknown;
}

interface TestResultPayload {
    testPoint: { id: string };
    testCase: { id: string };
    testCaseRevision: number;
    testCaseTitle: string;
    outcome: 'Passed' | 'Failed' | 'NotExecuted';
    durationInMs: number;
    state: 'Completed';
    errorMessage: string | null;
}

function makeRequest<T = unknown>(url: string, method: string, token: string, data: unknown = null): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        } as https.RequestOptions;

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk: string | Buffer) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const result = body ? JSON.parse(body) : {};
                    resolve({status: res.statusCode, data: result as T});
                } catch {
                    resolve({status: res.statusCode, data: body as unknown as T});
                }
            });
        });
        req.on('error', (error: Error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function getTestPointsForCase(
    orgUrl: string,
    project: string,
    token: string,
    planId: string,
    suiteId: string,
    testCaseId: string
): Promise<TestCasePoint[]> {
    const url = `${orgUrl}/${project}/_apis/test/Plans/${planId}/suites/${suiteId}/points?testCaseId=${testCaseId}&api-version=7.0`;
    const result = await makeRequest<AzureTestPointResponse>(url, 'GET', token);
    if (result.status && result.status >= 200 && result.status < 300) {
        const points: TestCasePoint[] = [];

        if (result.data.value && Array.isArray(result.data.value)) {
            for (const point of result.data.value) {
                const tcId = point.testCase.id;
                points.push({
                    testCaseId: tcId,
                    pointId: point.id,
                    testCaseName: point.testCase.name
                });
                console.log(`  Test Point: ${point.id} -> Test Case: ${tcId} (${point.testCase.name})`);
            }
        }

        return points;
    } else {
        console.warn(`  Failed to get test points for case ${testCaseId}: ${result.status} - ${JSON.stringify(result.data)}`);
        return [];
    }
}

async function getTestPoints(
    orgUrl: string,
    project: string,
    token: string,
    planId: string,
    suiteId: string,
    testCaseIds: string[]
): Promise<Map<string, TestPointInfo>> {
    console.log(`Fetching test points for test cases: ${testCaseIds.join(', ')}`);
    const points = new Map<string, TestPointInfo>();
    for (const testCaseId of testCaseIds) {
        const casePoints = await getTestPointsForCase(orgUrl, project, token, planId, suiteId, testCaseId);
        for (const cp of casePoints) {
            points.set(cp.testCaseId, {
                pointId: cp.pointId,
                testCaseName: cp.testCaseName
            });
        }
    }

    console.log(`Found ${points.size} test points`);
    return points;
}

async function getTestCaseRevision(
    orgUrl: string,
    project: string,
    token: string,
    testCaseId: string
): Promise<number> {
    const url = `${orgUrl}/${project}/_apis/wit/workItems/${testCaseId}?fields=System.Rev&api-version=7.0`;
    const result = await makeRequest<AzureWorkItemResponse>(url, 'GET', token);
    if (result.status && result.status >= 200 && result.status < 300) {
        const revision = (result.data.fields?.['System.Rev'] as number) || result.data.rev || 1;
        console.log(`  Test Case ${testCaseId} revision: ${revision}`);
        return revision;
    } else {
        console.warn(`  Could not get revision for test case ${testCaseId}: ${result.status} - using revision 1`);
        return 1;
    }
}

async function createTestRun(
    orgUrl: string,
    project: string,
    token: string,
    runName: string,
    planId: string
): Promise<number> {
    const url = `${orgUrl}/${project}/_apis/test/runs?api-version=7.0`;
    const data = {
        name: runName,
        automated: true,
        plan: {
            id: planId
        },
        state: 'InProgress'
    };

    const result = await makeRequest<AzureTestRunResponse>(url, 'POST', token, data);

    if (result.status && result.status >= 200 && result.status < 300) {
        console.log(`Created automated test run: ${result.data.id} (plan: ${planId})`);
        return result.data.id;
    } else {
        throw new Error(`Failed to create test run: ${result.status} - ${JSON.stringify(result.data)}`);
    }
}

async function addTestResults(
    orgUrl: string,
    project: string,
    token: string,
    runId: number,
    testResults: ParsedTestResult[],
    testPoints: Map<string, TestPointInfo>,
    revisionCache: Map<string, number>
): Promise<AzureTestResultAddResponse | void> {
    const url = `${orgUrl}/${project}/_apis/test/runs/${runId}/results?api-version=7.0`;

    const resultsToAdd: TestResultPayload[] = [];

    for (const r of testResults) {
        const testCaseId = r.azureTestCaseId.toString();

        const pointInfo = testPoints.get(testCaseId);
        if (!pointInfo) {
            console.warn(`  No test point found for test case ${testCaseId}, skipping`);
            continue;
        }

        let revision = revisionCache.get(testCaseId);
        if (!revision) {
            revision = await getTestCaseRevision(orgUrl, project, token, testCaseId);
            revisionCache.set(testCaseId, revision);
        }

        resultsToAdd.push({
            testPoint: {
                id: pointInfo.pointId.toString()
            },
            testCase: {
                id: testCaseId
            },
            testCaseRevision: revision,
            testCaseTitle: pointInfo.testCaseName,
            outcome: r.status === 'passed' ? 'Passed' : r.status === 'skipped' ? 'NotExecuted' : 'Failed',
            durationInMs: Math.round(r.duration || 0),
            state: 'Completed',
            errorMessage: r.errorMessage || null
        });
    }

    if (resultsToAdd.length === 0) {
        console.log('No valid test results to add (missing test points)');
        return;
    }

    console.log(`Adding ${resultsToAdd.length} test results to run ${runId}`);
    const result = await makeRequest<AzureTestResultAddResponse>(url, 'POST', token, resultsToAdd);
    if (result.status && result.status >= 200 && result.status < 300) {
        console.log(`Added ${result.data.count || (result.data as unknown as Array<unknown>).length} test results`);
        return result.data;
    } else {
        throw new Error(`Failed to add test results: ${result.status} - ${JSON.stringify(result.data)}`);
    }
}

async function completeTestRun(
    orgUrl: string,
    project: string,
    token: string,
    runId: number
): Promise<unknown> {
    const url = `${orgUrl}/${project}/_apis/test/runs/${runId}?api-version=7.0`;
    const data = {
        state: 'Completed'
    };

    const result = await makeRequest(url, 'PATCH', token, data);
    if (result.status && result.status >= 200 && result.status < 300) {
        console.log(`Completed test run: ${runId}`);
        return result.data;
    } else {
        throw new Error(`Failed to complete test run: ${result.status} - ${JSON.stringify(result.data)}`);
    }
}

async function main(): Promise<void> {
    console.log('Starting Azure Test Plans update...');
    const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
    const project = process.env.AZURE_DEVOPS_PROJECT;
    const token = process.env.SYSTEM_ACCESSTOKEN || process.env.AZURE_DEVOPS_TOKEN;
    const planId = process.env.AZURE_DEVOPS_TEST_PLAN_ID;
    const suiteId = process.env.AZURE_DEVOPS_TEST_SUITE_ID;

    if (!orgUrl) {
        throw new Error('Missing AZURE_DEVOPS_ORG_URL environment variable');
    }

    if (!project) {
        throw new Error('Missing AZURE_DEVOPS_PROJECT environment variable');
    }

    if (!token) {
        throw new Error('Missing SYSTEM_ACCESSTOKEN (pipeline) or AZURE_DEVOPS_TOKEN (local) environment variable');
    }

    if (!planId) {
        throw new Error('Missing AZURE_DEVOPS_TEST_PLAN_ID environment variable');
    }

    if (!suiteId) {
        throw new Error('Missing AZURE_DEVOPS_TEST_SUITE_ID environment variable');
    }

    console.log(`Organization: ${orgUrl}`);
    console.log(`Project: ${project}`);
    console.log(`Plan ID: ${planId}`);
    console.log(`Suite ID: ${suiteId}`);

    if (!fs.existsSync(PARSED_RESULTS_FILE)) {
        console.log(`No parsed results file found: ${PARSED_RESULTS_FILE}`);
        console.log('Run parse-test-results.ts first. Exiting.');
        process.exit(0);
    }

    const testResults: ParsedTestResult[] = JSON.parse(fs.readFileSync(PARSED_RESULTS_FILE, 'utf-8'));
    console.log(`Loaded ${testResults.length} test results`);
    const resultsWithAzureId = testResults.filter(r => r.azureTestCaseId);
    console.log(`${resultsWithAzureId.length} results have azureTestCaseId`);

    if (resultsWithAzureId.length === 0) {
        console.log('No results to update in Azure Test Plans');
        process.exit(0);
    }

    const testCaseIds = [...new Set(resultsWithAzureId.map(r => r.azureTestCaseId.toString()))];
    const testPoints = await getTestPoints(orgUrl, project, token, planId, suiteId, testCaseIds);
    const runName = `Playwright Tests - ${new Date().toISOString().split('T')[0]}`;
    const runId = await createTestRun(orgUrl, project, token, runName, planId);

    try {
        const revisionCache = new Map<string, number>();
        await addTestResults(orgUrl, project, token, runId, resultsWithAzureId, testPoints, revisionCache);
        await completeTestRun(orgUrl, project, token, runId);
        console.log('\n✅ Azure Test Plans updated successfully!');
        console.log(`Test Run URL: ${orgUrl}/${project}/_testRuns/explore?runId=${runId}`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Failed to update Azure Test Plans:', msg);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
