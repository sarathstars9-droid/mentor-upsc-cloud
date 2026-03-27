import { polityMapper } from "./subjectMappers/polityMapper.js";
import { governanceMapper } from "./subjectMappers/governanceMapper.js";
import { socialJusticeMapper } from "./subjectMappers/socialJusticeMapper.js";
import { irMapper } from "./subjectMappers/irMapper.js";
import { economyMapper } from "./subjectMappers/economyMapper.js";
import { agricultureMapper } from "./subjectMappers/agricultureMapper.js";
import { environmentMapper } from "./subjectMappers/environmentMapper.js";
import { scienceTechMapper } from "./subjectMappers/scienceTechMapper.js";
import { securityMapper } from "./subjectMappers/securityMapper.js";
import { disasterMapper } from "./subjectMappers/disasterMapper.js";
import { historyMapper } from "./subjectMappers/historyMapper.js";
import { artCultureMapper } from "./subjectMappers/artCultureMapper.js";
import { geographyMapper } from "./subjectMappers/geographyMapper.js";
import { societyMapper } from "./subjectMappers/societyMapper.js";
import { essayMapper } from "./subjectMappers/essayMapper.js";
import { ethicsMapper } from "./subjectMappers/ethicsMapper.js";
import { optionalGeographyMapper } from "./subjectMappers/optionalGeographyMapper.js";
import { csatMapper } from "./subjectMappers/csatMapper.js";

export const SUBJECT_MAPPER_REGISTRY = {
  polity: polityMapper,
  governance: governanceMapper,
  social_justice: socialJusticeMapper,
  international_relations: irMapper,
  economy: economyMapper,
  agriculture: agricultureMapper,
  environment: environmentMapper,
  science_tech: scienceTechMapper,
  security: securityMapper,
  disaster_management: disasterMapper,
  history: historyMapper,
  art_culture: artCultureMapper,
  geography: geographyMapper,
  society: societyMapper,
  essay: essayMapper,
  ethics: ethicsMapper,
  optional_geography: optionalGeographyMapper,
  csat: csatMapper
};
