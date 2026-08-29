export type Stage = {
  id: string;
  index: string;
  name: string;
  headline: string;
  copy: string[];
  chips: string[];
};

export const STAGES: Stage[] = [
  {
    id: "ingestion",
    index: "01",
    name: "Data ingestion",
    headline: "One survey package, six kinds of truth.",
    copy: [
      "Drone and aerial imagery, LiDAR point clouds, GIS layers, floor plans, GNSS/CORS control points and DEM/DSM terrain arrive together as a single mixed survey package.",
      "VERTICA auto-classifies every source, groups it by type and geo-references it against control points before a single polygon is drawn.",
    ],
    chips: ["6 source types", "Drone · LiDAR · GIS", "Floor plans · GNSS · DEM"],
  },
  {
    id: "polygons",
    index: "02",
    name: "2D polygon generation",
    headline: "Raster becomes verified vector.",
    copy: [
      "Computer vision contour extraction reads the orthophoto and proposes building footprints, cleaning noise, closing gaps and simplifying edges.",
      "An operator verifies each footprint. Vertices are numbered P1…Pn so every correction is traceable back to a person and a timestamp.",
    ],
    chips: ["raster → vector", "verified footprints", "P# vertices"],
  },
  {
    id: "reconstruction",
    index: "03",
    name: "3D reconstruction",
    headline: "Footprints lift into true height.",
    copy: [
      "LiDAR returns and DEM/DSM differencing give each footprint its real elevation; roof typology decides how the mass is capped.",
      "The extruded volume is then segmented floor by floor, producing building massing that matches what is actually standing on the ground.",
    ],
    chips: ["height from LiDAR/DEM", "floor segmentation", "low / mid / skyscraper"],
  },
  {
    id: "cadastral",
    index: "04",
    name: "3D cadastral",
    headline: "Parcel → body → floor → unit.",
    copy: [
      "Each building becomes a main parcel containing bodies, floors and units as bounded 3D volumes — with air rights above and subsurface assets below: basements, parking, and power, water and sewer corridors.",
      "Topology validation checks every volume for overlaps, gaps and containment errors before anything is allowed forward.",
    ],
    chips: ["parcel → body → floor → unit", "air + subsurface rights", "topology validated"],
  },
  {
    id: "ulpin",
    index: "05",
    name: "ULPIN assignment",
    headline: "A legal identity for every volume.",
    copy: [
      "Once the validation gate passes, each volume is issued a standardized national identity in the form 3D-IND-<pincode>-<body>-L<floor>-U<unit>.",
      "The identity is then frozen into the registry: immutable, auditable, and resolvable to a precise 3D extent rather than a flat plot.",
    ],
    chips: ["standardized ULPIN", "validation gate", "registry freeze"],
  },
  {
    id: "twin",
    index: "06",
    name: "Digital twin",
    headline: "A city you can walk through.",
    copy: [
      "Every stage assembles into a navigable twin. Roam the city, open a tower floor by floor, step into interiors and inspect the utility layer beneath the street.",
      "Operators see the full city. Citizens see exactly one thing: their own home, locked to their ULPIN.",
    ],
    chips: ["full-city roam", "floors + interiors + underground", "citizen = one locked house"],
  },
];
