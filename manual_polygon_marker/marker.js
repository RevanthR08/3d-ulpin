const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageInput = document.getElementById("imageInput");
const emptyState = document.getElementById("emptyState");
const closeBtn = document.getElementById("closeBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const pngBtn = document.getElementById("pngBtn");
const geojsonBtn = document.getElementById("geojsonBtn");
const polygonCount = document.getElementById("polygonCount");
const pointCount = document.getElementById("pointCount");
const imageSize = document.getElementById("imageSize");
const statusEl = document.getElementById("status");

let image = null;
let imageName = "uploaded_image";
let points = [];
let polygons = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function updateMeta() {
  polygonCount.textContent = String(polygons.length);
  pointCount.textContent = String(points.length);
  imageSize.textContent = image ? `${image.naturalWidth}×${image.naturalHeight}` : "—";
}

function fitCanvasToImage(img) {
  const maxW = Math.max(320, window.innerWidth - 430);
  const maxH = Math.max(320, window.innerHeight - 80);
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
}

function imagePointFromEvent(evt) {
  if (!image) return null;
  const rect = canvas.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * image.naturalWidth;
  const y = ((evt.clientY - rect.top) / rect.height) * image.naturalHeight;
  return [Math.round(x), Math.round(y)];
}

function canvasPoint([x, y]) {
  return [
    (x / image.naturalWidth) * canvas.width,
    (y / image.naturalHeight) * canvas.height,
  ];
}

function drawPolygon(poly, opts = {}) {
  if (!poly.length) return;
  const closed = opts.closed ?? false;
  const fill = opts.fill ?? "rgba(245, 202, 72, 0.32)";
  const stroke = opts.stroke ?? "#f5ca48";
  const labelPrefix = opts.labelPrefix ?? "";

  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.beginPath();
  poly.forEach((point, idx) => {
    const [x, y] = canvasPoint(point);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (closed && poly.length >= 3) ctx.closePath();
  if (closed && poly.length >= 3) ctx.fill();
  ctx.stroke();

  poly.forEach((point, idx) => {
    const [x, y] = canvasPoint(point);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? "#0c8f7c" : stroke;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Segoe UI, sans-serif";
    ctx.fillText(`${labelPrefix}${idx + 1}`, x + 8, y - 8);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!image) {
    updateMeta();
    return;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  polygons.forEach((poly, idx) => {
    drawPolygon(poly, {
      closed: true,
      fill: "rgba(245, 202, 72, 0.28)",
      stroke: "#f5ca48",
      labelPrefix: `P${idx + 1}.`,
    });
  });
  drawPolygon(points, { closed: false, fill: "rgba(12, 143, 124, 0.22)", stroke: "#0c8f7c" });

  updateMeta();
}

function closePolygon() {
  if (points.length < 3) {
    setStatus("Need 3+ points");
    return;
  }
  polygons.push([...points]);
  points = [];
  setStatus(`Closed polygon ${polygons.length}`);
  draw();
}

function clearPolygon() {
  points = [];
  polygons = [];
  setStatus(image ? "Ready" : "Waiting");
  draw();
}

function undoPoint() {
  if (points.length) {
    points.pop();
    setStatus(points.length ? "Editing" : "Ready");
  } else if (polygons.length) {
    points = polygons.pop() || [];
    setStatus("Reopened last polygon");
  } else {
    setStatus(image ? "Ready" : "Waiting");
  }
  draw();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeBaseName() {
  return imageName.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_") || "polygon";
}

function downloadPng() {
  if (!image) {
    setStatus("Upload image first");
    return;
  }
  if (points.length >= 3) closePolygon();
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${safeBaseName()}_marked_polygons.png`);
  }, "image/png");
}

function downloadGeoJson() {
  if (points.length >= 3) closePolygon();
  if (!polygons.length) {
    setStatus("No points");
    return;
  }
  const geojson = {
    type: "FeatureCollection",
    name: `${safeBaseName()}_manual_polygons`,
    metadata: {
      source_image: imageName,
      image_size: image ? { width: image.naturalWidth, height: image.naturalHeight } : null,
      coordinate_space: "image_pixels",
      created_by: "VERTICA manual polygon marker",
      polygon_count: polygons.length,
    },
    features: polygons.map((poly, idx) => {
      const ring = [...poly, poly[0]];
      return {
        type: "Feature",
        properties: {
          id: `manual-building-${String(idx + 1).padStart(3, "0")}`,
          label: `Verified manual building footprint ${idx + 1}`,
          status: "verified",
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      };
    }),
  };
  downloadBlob(
    new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" }),
    `${safeBaseName()}_polygons.geojson`,
  );
  setStatus("GeoJSON saved");
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  imageName = file.name;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    image = img;
    fitCanvasToImage(img);
    clearPolygon();
    emptyState.style.display = "none";
    setStatus("Ready");
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

canvas.addEventListener("click", (evt) => {
  const point = imagePointFromEvent(evt);
  if (!point) {
    setStatus("Upload image first");
    return;
  }
  points.push(point);
  setStatus("Editing");
  draw();
});

closeBtn.addEventListener("click", closePolygon);
undoBtn.addEventListener("click", undoPoint);
clearBtn.addEventListener("click", clearPolygon);
pngBtn.addEventListener("click", downloadPng);
geojsonBtn.addEventListener("click", downloadGeoJson);

window.addEventListener("keydown", (evt) => {
  if (evt.key === "Backspace") {
    evt.preventDefault();
    undoPoint();
  }
  if (evt.key === "Enter") closePolygon();
  if (evt.key === "Escape") clearPolygon();
});

window.addEventListener("resize", () => {
  if (!image) return;
  fitCanvasToImage(image);
  draw();
});

draw();
