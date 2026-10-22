/** The provider regions that are in Canada (data: a new region is a line here). */
export const CANADIAN_REGIONS = ["tor1", "ca-central-1", "ca-west-1", "ca-central", "ca-east", "ca-toronto-1", "ca-montreal-1", "canada-central", "canadacentral", "canadaeast"] as const;

export const residencyOf = (region: string): "canada" | "elsewhere" => ((CANADIAN_REGIONS as readonly string[]).includes(region.toLowerCase()) ? "canada" : "elsewhere");
