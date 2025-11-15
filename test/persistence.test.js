import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('POST /api/collection persiste dados no arquivo configurado', async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'collection-test-'));
  const dataPath = path.join(tempDir, 'collection.json');

  const previousNodeEnv = process.env.NODE_ENV;
  const previousCollectionPath = process.env.COLLECTION_FILE_PATH;

  process.env.NODE_ENV = 'test';
  process.env.COLLECTION_FILE_PATH = dataPath;

  const { startServer } = await import('../server.js');

  const server = startServer(0, { silent: true });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousCollectionPath === undefined) {
      delete process.env.COLLECTION_FILE_PATH;
    } else {
      process.env.COLLECTION_FILE_PATH = previousCollectionPath;
    }
  });

  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const initialResponse = await fetch(`${baseUrl}/api/collection`);
  assert.strictEqual(initialResponse.status, 200);
  const initialBody = await initialResponse.json();
  assert.deepEqual(initialBody, []);

  const sampleData = [
    {
      anoNumero: 42,
      anoLabel: 'Ano Teste',
      tema: 'Testando persistência',
      resumo: 'Verificar gravação.',
      badges: [],
      cartas: [],
      filmes: [],
      comidas: [],
    },
  ];

  const postResponse = await fetch(`${baseUrl}/api/collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleData),
  });
  assert.strictEqual(postResponse.status, 204);

  const fileContents = await readFile(dataPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), sampleData);

  const reloadResponse = await fetch(`${baseUrl}/api/collection`);
  assert.strictEqual(reloadResponse.status, 200);
  const reloadBody = await reloadResponse.json();
  assert.deepEqual(reloadBody, sampleData);
});
