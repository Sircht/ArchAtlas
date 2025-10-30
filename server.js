import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = __dirname;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDOJb2_2hPShr2KC7AJaFFUZvKrKdvAZmI";

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
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));
