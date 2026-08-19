export type Sex = 'M' | 'F'

export type SubtestId =
  | 'sprint_40m'
  | 'vertical_jump_cm'
  | 'broad_jump_cm'
  | 'grip_strength_left_kg'
  | 'grip_strength_right_kg'
  | 'midthigh_pull_n'
  | 'sit_reach_cm'
  | 'balance_left_s'
  | 'balance_right_s'

export type ResultStatus = 'completed' | 'skipped'

export interface AthleteIdentity {
  name: string
  athlete_id: string
  age: number
  sex: Sex
  sport: string
  tested_on: string
}

export interface Administration {
  facility: string
  administered_by: string
  conditions_note: string
}

export interface RawResult {
  subtest: SubtestId
  raw: number | null
  status: ResultStatus
  note?: string
}

export interface AthleteExport {
  athlete: AthleteIdentity
  administration: Administration
  results: RawResult[]
}

export type AgeBand = '18_29' | '30_39' | '40_plus'

export type Band = 'below' | 'typical' | 'above' | 'skipped' | 'unbenchmarked'

export type FlagKind =
  | 'skipped'
  | 'tester_note'
  | 'conditions'
  | 'asymmetry'
  | 'verify_outlier'
  | 'no_handbook'
  | 'quality'

export interface Flag {
  kind: FlagKind
  subtest?: SubtestId
  text: string
}

export interface TestView {
  subtest: SubtestId
  label: string
  unit: string
  raw: number | null
  status: ResultStatus
  note?: string
  band: Band
  range?: { lo: number; hi: number }
  better: 'lower' | 'higher' | 'unknown'
}

export interface Analysis {
  athlete: AthleteIdentity
  administration: Administration
  ageBand: AgeBand
  ageBandLabel: string
  tests: TestView[]
  flags: Flag[]
  keep: TestView[]
  focus: TestView[]
  midthigh?: {
    raw: number
    rank: number
    of: number
  }
}

export interface ReportSection {
  heading: string
  body: string
}

export interface ReportDraft {
  headline: string
  overview: string
  takeaways: ReportSection[]
  recommendations: ReportSection[]
  caveats: string[]
  coach_brief: string
}

export type DraftSource = 'grok' | 'template'

export interface GenerateMeta {
  source: DraftSource
  model: string
  promptVersion: string
  generatedAt: string
  warning?: string
}

export type AthleteStatus = 'new' | 'draft' | 'signed'

export interface AthleteRecord {
  sourceName: string
  export: AthleteExport
  analysis: Analysis
  draft?: ReportDraft
  letter?: ReportDraft
  status: AthleteStatus
  signedAt?: string
  signedBy?: string
  generateMeta?: GenerateMeta
}

export interface CombineSession {
  version: 1
  coachName: string
  loadedAt: string
  athletes: Record<string, AthleteRecord>
}
