// SOC Mapping Types
export interface SocProgram {
  name: string;
  soc: string;
  description: string;
}

export interface SocCategory {
  category: string;
  programs: SocProgram[];
}

export interface SocMap {
  programs: SocCategory[];
}

// County-Level OEWS Data Types
export interface CountyOews {
  geoid: string; // 5-digit FIPS code
  countyName: string;
  state: string;
  year: number;
  soc: string;
  socTitle: string;
  employment: number | null;
  employmentRse?: number; // Relative Standard Error (%)
  meanWage: number | null; // Annual mean wage
  meanWageRse?: number;
  medianWage: number | null; // Annual median wage
  medianWageRse?: number;
  hourlyMeanWage?: number | null;
  hourlyMedianWage?: number | null;
  pct10Wage?: number | null; // 10th percentile wage
  pct25Wage?: number | null; // 25th percentile wage
  pct75Wage?: number | null; // 75th percentile wage
  pct90Wage?: number | null; // 90th percentile wage
}

// State-Level Projections Data Types
export interface StateProjection {
  state: string;
  soc: string;
  socTitle: string;
  baseYear: number;
  projectionYear: number;
  baseEmployment: number;
  projectedEmployment: number;
  employmentChange: number;
  employmentChangePercent: number; // Growth percentage
  annualOpenings: number; // Average annual openings
  exitingOpenings?: number; // Openings due to workforce exits
  transferOpenings?: number; // Openings due to occupational transfers
  growthOpenings?: number; // Openings due to employment growth
}

// CBSA to County Crosswalk Types
export interface CbsaCountyCrosswalk {
  cbsaCode: string;
  cbsaTitle: string;
  countyGeoid: string;
  countyName: string;
  state: string;
  allocationWeight: number; // Share of CBSA data allocated to this county (default: equal shares)
}

// BLS API Types
export interface BlsSeriesRequest {
  seriesid: string[];
  startyear?: string;
  endyear?: string;
  catalog?: boolean;
  calculations?: boolean;
  annualaverage?: boolean;
  registrationkey?: string;
}

export interface BlsDataPoint {
  year: string;
  period: string;
  periodName: string;
  value: string;
  footnotes?: Array<{ code: string; text: string }>;
}

export interface BlsSeries {
  seriesID: string;
  data: BlsDataPoint[];
}

export interface BlsApiResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results: {
    series: BlsSeries[];
  };
}

// Map Data Integration Types
export interface CountyMapData extends CountyOews {
  stateProjection?: StateProjection;
  color?: string; // For choropleth coloring
}

export interface MapFilters {
  selectedSoc: string | null;
  metric: 'employment' | 'meanWage' | 'medianWage' | 'growth' | 'openings';
  year: number;
}

// ETL Utility Types
export interface EtlConfig {
  inputPath: string;
  outputPath: string;
  year?: number;
}

export interface EtlResult {
  success: boolean;
  recordsProcessed: number;
  outputPath: string;
  errors?: string[];
}

