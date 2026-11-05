/**
 * Municipal Waters & Ocean Territorial Boundary of Mabini, Batangas.
 * 
 * Legal Basis:
 * - Republic Act No. 8550 (The Philippine Fisheries Code of 1998, Section 123)
 * - DENR Administrative Order (DAO) No. 2001-17 / NAMRIA Guidelines
 * - Comprehensive Land Use Plan (CLUP) & Socio-Ecological Profile of Mabini
 * - National Mapping and Resource Information Authority (NAMRIA) Base Mapping
 * 
 * Geographic Context:
 * - West: Balayan Bay (15-kilometer municipal waters outer arc / median line)
 * - South: Maricaban Strait (Equidistant median line separating Calumpan Peninsula and Tingloy Island)
 * - East: Batangas Bay (Offshore municipal waters limit)
 * - North: Coastal boundary terminals intersecting Bauan Municipality
 * Total Enclosed Marine Water Area: ~10,540 hectares
 */

export interface MaritimeBoundaryPoint {
  lat: number;
  lng: number;
  label: string;
  description: string;
}

/**
 * Seaward nautical boundary polyline of Mabini, Batangas.
 * Connects the western coastal terminal at Bauan, sweeps out into Balayan Bay,
 * passes south through the Maricaban Strait along the median line with Tingloy,
 * loops through Batangas Bay, and closes at the eastern coastal terminal with Bauan.
 */
export const MABINI_OCEAN_TERRITORIAL_LINE: [number, number][] = [
  // 1. Bauan-Mabini West Coastal Terminal (Balayan Bay)
  [13.7669648, 120.9264628],
  // 2. Balayan Bay North-West Limit (15 km outer municipal water limit)
  [13.768512, 120.8210181],
  // 3. Balayan Bay Outer Sector
  [13.7152613, 120.8464082],
  // 4. Balayan Bay Mid Sector (Facing western Calumpan Peninsula)
  [13.7046489, 120.8568328],
  // 5. Maricaban Strait NW Entrance (Between Calumpan tip and Caban Island)
  [13.6882963, 120.8654169],
  // 6. Maricaban Strait Median Line (North of Caban / Maricaban Island, Tingloy)
  [13.6726461, 120.8854931],
  // 7. Maricaban Strait Median Point
  [13.6707577, 120.8889198],
  // 8. Maricaban Strait Channel Center
  [13.6699654, 120.8915805],
  // 9. Maricaban Strait East Median
  [13.6697569, 120.8946275],
  // 10. Batangas Bay SW Entrance (Offshore of Mainit / Cazador point)
  [13.6759341, 120.9119517],
  // 11. Batangas Bay Channel Offshore Limit
  [13.6853499, 120.9490807],
  // 12. Batangas Bay Outer Boundary
  [13.6944499, 120.9856656],
  // 13. Bauan-Mabini East Coastal Terminal (Batangas Bay)
  [13.7713103, 120.9644441],
];

/**
 * Closed municipal waters polygon including the coastline baseline
 * for subtle water area shading in GIS / mapping layers.
 */
export const MABINI_MUNICIPAL_WATERS_POLYGON: [number, number][] = [
  ...MABINI_OCEAN_TERRITORIAL_LINE,
  // Coastline / Landward baseline across northern peninsula connecting east & west terminals
  [13.7654356, 120.9292495],
  [13.7669648, 120.9264628],
];

export const MABINI_TERRITORY_METADATA = {
  jurisdiction: "Mabini, Batangas, Philippines",
  bodyOfWater: ["Balayan Bay", "Maricaban Strait", "Batangas Bay"],
  governingLaw: "Republic Act No. 8550 (The Philippine Fisheries Code of 1998)",
  delineationStandard: "DENR DAO 2001-17 / NAMRIA Hydrographic Base Mapping",
  areaHectares: 10540,
  oppositeShoreMunicipality: "Tingloy (Maricaban Island)",
  adjacentMunicipality: "Bauan",
};
