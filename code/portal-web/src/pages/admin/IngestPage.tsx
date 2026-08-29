import { Link } from 'react-router-dom'
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import cityCore from '../../assets/input_city_core.png'
import cityWide from '../../assets/input_city_wide.png'

type SourceId = 'drone' | 'lidar' | 'gis' | 'floorplans' | 'gnss' | 'elevation' | 'archive' | 'other'

type SourceGroup = {
  id: SourceId
  label: string
  folder: string
  hint: string
}

const SOURCE_GROUPS: SourceGroup[] = [
  { id: 'drone', label: 'Drone / Aerial', folder: 'drone/', hint: 'JPG · PNG · TIF · GeoTIFF' },
  { id: 'lidar', label: 'LiDAR', folder: 'lidar/', hint: 'LAS · LAZ · PLY · E57' },
  { id: 'gis', label: 'GIS', folder: 'gis/', hint: 'GeoJSON · SHP · GPKG · KML' },
  { id: 'floorplans', label: 'Floor Plans', folder: 'floorplans/', hint: 'PDF · DXF · SVG · DWG' },
  { id: 'gnss', label: 'GNSS', folder: 'gnss/', hint: 'CSV · NMEA · GPX' },
  { id: 'elevation', label: 'DEM / DSM', folder: 'elevation/', hint: 'DEM · DSM · ASC · HGT · terrain TIF' },
  { id: 'archive', label: 'ZIP Package', folder: 'package/', hint: 'ZIP' },
  { id: 'other', label: 'Other', folder: 'other/', hint: 'Unclassified support files' },
]

const CORE_SOURCE_IDS: SourceId[] = ['drone', 'lidar', 'gis', 'floorplans', 'gnss', 'elevation']

const DEMO_FILES: Array<readonly [string, number, string]> = [
  ['input_data_sample/drone/city_core_top_view.png', 64_000_000, 'image/png'],
  ['input_data_sample/drone/city_context_wide_view.png', 82_000_000, 'image/png'],
  ['input_data_sample/drone/orthomosaic_tile_01.tif', 3_200_000_000, 'image/tiff'],
  ['input_data_sample/drone/orthomosaic_tile_02.tif', 2_950_000_000, 'image/tiff'],
  ['input_data_sample/lidar/urban_block_scan.laz', 4_600_000_000, 'application/octet-stream'],
  ['input_data_sample/lidar/rooftop_height_cloud.ply', 1_700_000_000, 'application/octet-stream'],
  ['input_data_sample/lidar/street_level_scan.e57', 3_000_000_000, 'application/octet-stream'],
  ['input_data_sample/gis/parcel_boundaries.geojson', 28_000_000, 'application/geo+json'],
  ['input_data_sample/gis/building_footprints.geojson', 24_000_000, 'application/geo+json'],
  ['input_data_sample/gis/road_network.gpkg', 46_000_000, 'application/geopackage+sqlite3'],
  ...Array.from({ length: 100 }, (_, i) => [
    `input_data_sample/floorplans/tower_${String.fromCharCode(65 + (i % 4))}_floor_${String(i + 1).padStart(3, '0')}.pdf`,
    14_000_000 + (i % 8) * 650_000,
    'application/pdf',
  ] as const),
  ['input_data_sample/gnss/cors_reference_points.csv', 820_000, 'text/csv'],
  ['input_data_sample/gnss/gcp_observations.nmea', 1_400_000, 'text/plain'],
  ['input_data_sample/gnss/control_points.json', 950_000, 'application/json'],
  ['input_data_sample/elevation/dem_0_5m.tif', 780_000_000, 'image/tiff'],
  ['input_data_sample/elevation/dsm_0_5m.tif', 790_000_000, 'image/tiff'],
]

function cleanPath(file: File) {
  return file.webkitRelativePath || file.name
}

function extensionOf(file: File) {
  const name = file.name.toLowerCase()
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
}

function classifyFile(file: File): SourceId {
  const name = file.name.toLowerCase()
  const path = cleanPath(file).toLowerCase()
  const ext = extensionOf(file)

  if (ext === 'zip') return 'archive'
  if (/(lidar|point[\s_-]?cloud|las|laz)/.test(path) || ['las', 'laz', 'ply', 'e57', 'xyz'].includes(ext)) {
    return 'lidar'
  }
  if (/(gnss|gps|cors|nmea|coordinate|control[\s_-]?point|gcp)/.test(path) || ['nmea', 'gpx'].includes(ext)) {
    return 'gnss'
  }
  if (
    /(dem|dsm|dtm|elevation|terrain|contour|surface)/.test(path) ||
    ['asc', 'hgt'].includes(ext)
  ) {
    return 'elevation'
  }
  if (
    /(floor|plan|blueprint|layout|cad)/.test(path) ||
    ['pdf', 'dxf', 'dwg', 'svg'].includes(ext)
  ) {
    return 'floorplans'
  }
  if (
    /(parcel|boundary|cadastre|gis|shapefile|map)/.test(path) ||
    ['geojson', 'shp', 'shx', 'dbf', 'prj', 'gpkg', 'kml', 'kmz'].includes(ext)
  ) {
    return 'gis'
  }
  if (
    /(drone|aerial|satellite|ortho|orthophoto|image|imagery|roof)/.test(path) ||
    ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp', 'jp2'].includes(ext)
  ) {
    return 'drone'
  }
  if (ext === 'csv') return name.includes('parcel') || name.includes('building') ? 'gis' : 'gnss'
  if (ext === 'json') return name.includes('gnss') || name.includes('gps') ? 'gnss' : 'gis'
  return 'other'
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function packageName(files: File[]) {
  const folder = files.find((f) => f.webkitRelativePath)?.webkitRelativePath.split('/')[0]
  if (folder) return folder
  if (files.length === 1) return files[0].name.replace(/\.[^.]+$/, '')
  return `Survey_Package_${new Date().toISOString().slice(0, 10)}`
}

function makeDemoFile(path: string, size: number, type: string) {
  const file = new File([`VERTICA demo placeholder for ${path}\n`], path, {
    type,
    lastModified: Date.parse('2026-08-26T10:30:00+05:30') + size,
  })
  Object.defineProperty(file, 'webkitRelativePath', {
    value: path,
    configurable: true,
  })
  Object.defineProperty(file, 'size', {
    value: size,
    configurable: true,
  })
  return file
}

const DRONE_PREVIEWS = [
  { label: 'City context wide view', src: cityWide },
  { label: 'Core property block', src: cityCore },
  { label: 'North-east drone pass', src: cityWide },
  { label: 'South-west drone pass', src: cityCore },
]

const BLUEPRINT_PREVIEWS = [
  'Tower A · typical floor',
  'Tower B · residential floor',
  'Basement parking level',
  'Community block plan',
]

function shortFileName(file: File) {
  return cleanPath(file).split('/').pop() || file.name
}

function SourcePreview({
  group,
  files,
}: {
  group: SourceGroup
  files: File[]
}) {
  if (!files.length) return null
  const shown = files.slice(0, 6)

  return (
    <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Source preview</div>
          <div className="mt-1 text-[18px] font-semibold text-ink">{group.label}</div>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-signal-deep">
          {files.length} files detected
        </div>
      </div>

      {group.id === 'drone' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DRONE_PREVIEWS.map((item) => (
            <div key={item.label} className="overflow-hidden rounded-xl border border-line bg-white">
              <img src={item.src} alt={item.label} className="h-36 w-full object-cover" />
              <div className="px-3 py-2 text-[12px] font-semibold text-ink">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {group.id === 'floorplans' && (
        <>
          <div className="mt-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-[12px] leading-relaxed text-amber">
            {files.length} floor plans detected. Showing only 4 blueprint previews to keep the demo fast.
            Remaining {Math.max(0, files.length - 4)} plans are indexed but not opened here.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BLUEPRINT_PREVIEWS.map((label, i) => (
              <div key={label} className="rounded-xl border border-line bg-white p-4">
                <div className="relative h-32 overflow-hidden rounded-lg bg-[#eef3f7]">
                  <div className="absolute inset-4 border-2 border-[#4c7ea8]" />
                  <div className="absolute left-8 top-8 h-10 w-16 border border-[#4c7ea8]" />
                  <div className="absolute bottom-8 right-8 h-12 w-20 border border-[#4c7ea8]" />
                  <div className="absolute left-1/2 top-4 h-24 border-l border-dashed border-[#4c7ea8]" />
                  <div className="absolute bottom-4 left-4 right-4 border-t border-dashed border-[#4c7ea8]" />
                </div>
                <div className="mt-3 text-[12px] font-semibold text-ink">{label}</div>
                <div className="font-mono mt-1 text-[10px] text-mute">{shortFileName(files[i] || files[0])}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!['drone', 'floorplans'].includes(group.id) && (
        <div className="mt-4 grid gap-2">
          {shown.map((file) => (
            <div key={`${cleanPath(file)}:${file.size}`} className="rounded-xl border border-line bg-white px-4 py-3">
              <div className="font-mono text-[11px] text-ink">{shortFileName(file)}</div>
              <div className="mt-1 text-[11px] text-mute">{formatBytes(file.size)} · {group.hint}</div>
            </div>
          ))}
          {files.length > shown.length && (
            <div className="rounded-xl bg-white px-4 py-3 text-[12px] text-mute">
              + {files.length - shown.length} more files indexed
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function IngestPage() {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceId | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const zipInputRef = useRef<HTMLInputElement | null>(null)

  const grouped = useMemo(() => {
    const seed = Object.fromEntries(SOURCE_GROUPS.map((g) => [g.id, [] as File[]])) as Record<SourceId, File[]>
    for (const file of files) seed[classifyFile(file)].push(file)
    return seed
  }, [files])

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])
  const detectedSourceCount = CORE_SOURCE_IDS.filter((id) => grouped[id].length > 0).length
  const detectedGroups = SOURCE_GROUPS.filter((group) => grouped[group.id].length > 0)
  const surveyName = files.length ? packageName(files) : 'No package selected'
  const previewGroup = SOURCE_GROUPS.find((group) => group.id === selectedSource)

  function loadSamplePackage() {
    setFiles(DEMO_FILES.map(([path, size, type]) => makeDemoFile(path, size, type)))
    setSelectedSource('floorplans')
  }

  function addFiles(incoming: FileList | File[]) {
    if (!Array.from(incoming).length) return
    loadSamplePackage()
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function clearPackage() {
    setFiles([])
    setSelectedSource(null)
  }

  function loadDemoPackage() {
    loadSamplePackage()
  }

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-8 px-7 py-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Data Ingestion</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          Drop any file — the demo loads the sample survey (100 floor plans plus drone, LiDAR, GIS, GNSS, DEM).
        </p>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onInput} />
      <input
        ref={(el) => {
          folderInputRef.current = el
          el?.setAttribute('webkitdirectory', '')
        }}
        type="file"
        multiple
        className="hidden"
        onChange={onInput}
      />
      <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={onInput} />

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-[28px] border-2 border-dashed p-8 text-center transition ${
          dragging ? 'border-signal bg-signal-soft/70' : 'border-line bg-white'
        }`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-signal-soft text-[28px]">
          ↑
        </div>
        <h2 className="font-display mt-5 text-[26px] font-semibold text-ink">Upload Survey / Property Data</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-mute">
          Drag and drop any file or folder. The demo loads the sample survey package (100 floor plans).
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-ink px-5 py-3 text-[13px] font-semibold text-white"
          >
            Browse Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="rounded-xl border border-line bg-paper px-5 py-3 text-[13px] font-semibold text-ink"
          >
            Browse Folder
          </button>
          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            className="rounded-xl border border-line bg-paper px-5 py-3 text-[13px] font-semibold text-ink"
          >
            Upload ZIP Package
          </button>
          <button
            type="button"
            onClick={loadDemoPackage}
            className="rounded-xl border border-signal/30 bg-signal-soft px-5 py-3 text-[13px] font-semibold text-signal-deep"
          >
            Load Demo Survey Package
          </button>
        </div>

        <div className="mt-5 text-[12px] text-mute">Supports multiple files and mixed data sources.</div>
      </div>

      {files.length > 0 && (
        <div className="rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Survey Package</div>
              <div className="font-display mt-1 text-[26px] font-semibold text-ink">{surveyName}</div>
              <div className="mt-1 text-[13px] text-mute">
                {files.length} files · {formatBytes(totalSize)}
              </div>
            </div>
            <div className="rounded-full border border-signal/30 bg-signal-soft px-4 py-2 text-[12px] font-semibold text-signal-deep">
              Sample package loaded
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-[1fr_280px]">
            <div className="p-6">
              <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Detected sources</div>
              <div className="mt-4 space-y-3">
                {SOURCE_GROUPS.map((group) => {
                  const count = grouped[group.id].length
                  return (
                    <button
                      key={group.id}
                      type="button"
                      disabled={!count}
                      onClick={() => setSelectedSource(group.id)}
                      className={`grid w-full grid-cols-[1fr_70px] items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                        selectedSource === group.id
                          ? 'bg-signal-soft'
                          : count
                            ? 'hover:bg-paper'
                            : 'cursor-not-allowed opacity-70'
                      }`}
                    >
                      <div>
                        <div className={`text-[14px] font-semibold ${count ? 'text-ink' : 'text-mute/45'}`}>
                          {group.label}
                        </div>
                        <div className="font-mono mt-0.5 text-[10px] text-mute">{group.hint}</div>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-center text-[12px] font-semibold ${
                          count ? 'bg-signal-soft text-signal-deep' : 'bg-paper text-mute'
                        }`}
                      >
                        {count}
                      </div>
                    </button>
                  )
                })}
              </div>
              {previewGroup && (
                <SourcePreview group={previewGroup} files={grouped[previewGroup.id]} />
              )}
            </div>

            <div className="border-t border-line bg-paper p-6 md:border-l md:border-t-0">
              <div className="text-[11px] uppercase tracking-[0.14em] text-mute">Package tree</div>
              <div className="font-mono mt-4 space-y-2 text-[12px] text-ink">
                <div>{surveyName}</div>
                {detectedGroups.map((group) => (
                  <div key={group.id} className="text-mute">
                    ├── {group.folder.padEnd(14, ' ')} {grouped[group.id].length} files
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-5">
            <div>
              <div className="text-[14px] font-semibold text-ink">
                {files.length} files · {detectedSourceCount || detectedGroups.length} data sources · {formatBytes(totalSize)}
              </div>
              <div className="mt-1 text-[12px] text-mute">
                Sample survey staged — 100 floor plans indexed. Ready for AI processing.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearPackage}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
              >
                Clear
              </button>
              <Link
                to="/app/processing"
                className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Start AI Pipeline
              </Link>
              <a
                href="/extract/"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
              >
                Review Package
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
