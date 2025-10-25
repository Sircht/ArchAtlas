import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/export-dwg", async (req, res) => {
  let { south, west, north, east } = req.query;

  // Se os limites forem muito pequenos, expande levemente
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
      headers: { "Content-Type": "text/plain" },
    });

    const data = await response.json();

    if (!data.elements?.length) {
      return res.status(404).send("Nenhuma geometria encontrada nesta área.");
    }

    // Montagem DXF aprimorada
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

      const layer = el.tags?.building ? "EDIFICIOS" : el.tags?.highway ? "VIAS" : "OUTROS";
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
        // conversão simples: longitude → X, latitude → Y
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));
