import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = __dirname;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDOJb2_2hPShr2KC7AJaFFUZvKrKdvAZmI";

const defaultDataDir = path.join(__dirname, "data");
const dataFileOverride = process.env.COLLECTION_FILE_PATH;
const dataFilePath = dataFileOverride
  ? path.resolve(dataFileOverride)
  : path.join(defaultDataDir, "collection.json");
const dataDir = path.dirname(dataFilePath);
const sseClients = new Set();

async function ensureDataFile() {
  try {
    await fs.access(dataFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFilePath, "[]", "utf8");
  }
}

async function readCollection() {
  await ensureDataFile();

  const raw = await fs.readFile(dataFilePath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
      return parsed;
    }

    return [];
  } catch (error) {
    console.warn("Arquivo de coleção inválido, recriando com lista vazia.");
    await fs.writeFile(dataFilePath, "[]", "utf8");
    return [];
  }
}

async function writeCollection(data) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), "utf8");
}

function broadcastCollectionUpdate({ sourceId = null } = {}) {
  if (!sseClients.size) {
    return;
  }

  const payload = JSON.stringify({
    type: "collection:update",
    sourceId,
    updatedAt: new Date().toISOString()
  });

  for (const client of sseClients) {
    try {
      client.res.write("event: collection-update\n");
      client.res.write(`data: ${payload}\n\n`);
    } catch (error) {
      sseClients.delete(client);
    }
  }
}

app.get("/api/collection", async (req, res) => {
  try {
    const data = await readCollection();
    res.json(data);
  } catch (error) {
    console.error("Erro ao carregar coleção:", error);
    res.status(500).json({ message: "Não foi possível carregar a coleção." });
  }
});

app.post("/api/collection", async (req, res) => {
  const body = req.body;
  const clientId = req.get("x-client-id") || null;

  if (!Array.isArray(body) && (typeof body !== "object" || body === null)) {
    return res.status(400).json({ message: "Formato inválido. A coleção deve ser uma lista ou um objeto." });
  }

  try {
    await writeCollection(body);
    broadcastCollectionUpdate({ sourceId: clientId });
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao salvar coleção:", error);
    res.status(500).json({ message: "Não foi possível salvar a coleção." });
  }
});

app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const client = { res };
  sseClients.add(client);

  res.write("event: connected\n");
  res.write("data: {}\n\n");

  const heartbeat = setInterval(() => {
    try {
      res.write(":heartbeat\n\n");
    } catch (error) {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

app.use(express.static(publicDir));

app.get("/export-png", async (req, res) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).send("Chave da API do Google Maps não configurada.");
  }

  const { center, zoom, scale = 1, width = 640, height = 360, mapId } = req.query;

  if (!center || !zoom) {
    return res.status(400).send("Parâmetros insuficientes para exportação PNG.");
  }

  const [lat, lng] = String(center)
    .split(",")
    .map((value) => Number.parseFloat(value));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).send("Centro do mapa inválido.");
  }

  const parsedZoom = Number.parseFloat(String(zoom));
  const parsedScale = Number.parseInt(String(scale), 10);
  const parsedWidth = Number.parseInt(String(width), 10);
  const parsedHeight = Number.parseInt(String(height), 10);

  const safeZoom = Number.isFinite(parsedZoom) ? Math.max(0, Math.min(22, parsedZoom)) : 17;
  const safeScale = Number.isFinite(parsedScale) ? Math.max(1, Math.min(2, parsedScale)) : 1;
  const safeWidth = Number.isFinite(parsedWidth) ? Math.max(1, Math.min(640, parsedWidth)) : 640;
  const safeHeight = Number.isFinite(parsedHeight) ? Math.max(1, Math.min(640, parsedHeight)) : 360;

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(Math.round(safeZoom)),
    size: `${safeWidth}x${safeHeight}`,
    scale: String(safeScale),
    key: GOOGLE_MAPS_API_KEY
  });

  if (mapId) {
    params.append("map_id", String(mapId));
  }

  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  try {
    const response = await fetch(staticMapUrl);
    if (!response.ok) {
      throw new Error(`Static Maps API respondeu com ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "attachment; filename=archatlas.png");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Erro ao gerar PNG:", err);
    res.status(500).send("Erro ao gerar imagem PNG.");
  }
});

app.use(express.static(publicDir));

app.get("/export-dwg", async (req, res) => {
  let { south, west, north, east } = req.query;

  if (!south || !west || !north || !east) {
    return res.status(400).send("Parâmetros incompletos para exportação DWG.");
  }

  const expand = 0.002;
  south = parseFloat(south) - expand;
  west = parseFloat(west) - expand;
  north = parseFloat(north) + expand;
  east = parseFloat(east) + expand;

  const query = `
[out:json][timeout:30];
(
  way["building"](${south},${west},${north},${east});
  way["highway"](${south},${west},${north},${east});
  way["landuse"](${south},${west},${north},${east});
  way["natural"](${south},${west},${north},${east});
  way["leisure"](${south},${west},${north},${east});
  way["waterway"](${south},${west},${north},${east});
  relation["landuse"](${south},${west},${north},${east});
);
out geom;
`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" }
    });

    if (!response.ok) {
      throw new Error(`Overpass API respondeu com ${response.status}`);
    }

    const data = await response.json();

    if (!data.elements?.length) {
      return res.status(404).send("Nenhuma geometria encontrada nesta área.");
    }

    let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
0
ENDSEC
0
SECTION
2
ENTITIES
`;

    for (const el of data.elements) {
      if (!el.geometry) continue;

      const layer = el.tags?.building
        ? "EDIFICIOS"
        : el.tags?.highway
        ? "VIAS"
        : "OUTROS";
      const closed =
        el.geometry[0].lat === el.geometry[el.geometry.length - 1].lat &&
        el.geometry[0].lon === el.geometry[el.geometry.length - 1].lon;

      dxf += `0
LWPOLYLINE
8
${layer}
90
${el.geometry.length}
70
${closed ? 1 : 0}
`;

      for (const pt of el.geometry) {
        dxf += `10
${pt.lon}
20
${pt.lat}
`;
      }
    }

    dxf += `0
ENDSEC
0
EOF`;

    res.setHeader("Content-Disposition", "attachment; filename=export_mapa.dxf");
    res.setHeader("Content-Type", "application/dxf");
    res.send(dxf);
  } catch (err) {
    console.error("Erro ao gerar DWG:", err);
    res.status(500).send("Erro ao gerar arquivo DWG.");
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;

export function startServer(port = PORT, { silent = false } = {}) {
  return app.listen(port, () => {
    if (!silent) {
      console.log(`✅ Servidor rodando em http://localhost:${port}`);
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer(PORT);
}

export { app };
