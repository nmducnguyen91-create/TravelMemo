/**
 * Builds the exact text sent to the AI provider. Pure functions: the UI shows this text to the owner before sending.
 * Never included: photos, coordinates, IDs, account or device details.
 */

export interface AiRequest {
  readonly system: string;
  readonly prompt: string;
}

export interface JourneyContextInput {
  readonly title: string;
  readonly description: string | null;
  readonly dateRange: string;
  readonly status: string;
  readonly visits: readonly { placeName: string; date: string; region: string; transit: boolean; note: string | null }[];
  readonly journal: readonly { title: string | null; body: string }[];
  /** Names are only passed when the owner ticks "include companions". */
  readonly companions: readonly string[];
}

export interface HistoryContextInput {
  readonly today: string;
  readonly countries: number;
  readonly countriesTotal: number;
  readonly provinces: number;
  readonly provincesTotal: number;
  readonly continents: number;
  readonly places: number;
  readonly countryNames: readonly string[];
  readonly provinceNames: readonly string[];
  readonly trips: readonly { title: string; dateRange: string; status: string; places: readonly string[] }[];
}

/** Upper bound on context text so a very large archive cannot produce a runaway bill. */
export const MAX_CONTEXT_CHARS = 60_000;

export function clip(text: string, max = MAX_CONTEXT_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…(đã rút gọn phần còn lại)`;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function journeyContextText(j: JourneyContextInput): string {
  const lines = [`Hành trình: ${oneLine(j.title)}`, `Thời gian: ${j.dateRange}`, `Trạng thái: ${j.status}`];
  if (j.description) lines.push(`Mô tả: ${oneLine(j.description)}`);
  if (j.companions.length) lines.push(`Đi cùng: ${j.companions.map(oneLine).join(', ')}`);
  lines.push('', 'Các điểm đến (theo thời gian):');
  if (!j.visits.length) lines.push('- (chưa có điểm đến)');
  for (const v of j.visits) {
    const where = v.region ? ` (${v.region})` : '';
    const note = v.note ? ` — ghi chú: ${oneLine(v.note)}` : '';
    lines.push(`- ${v.date}: ${oneLine(v.placeName)}${where}${v.transit ? ' [quá cảnh]' : ''}${note}`);
  }
  if (j.journal.length) {
    lines.push('', 'Nhật ký đã viết:');
    for (const e of j.journal) lines.push(`- ${e.title ? `${oneLine(e.title)}: ` : ''}${oneLine(e.body)}`);
  }
  return clip(lines.join('\n'));
}

export function historyContextText(h: HistoryContextInput): string {
  const lines = [
    `Hôm nay: ${h.today}`,
    `Đã đến ${h.countries}/${h.countriesTotal} quốc gia và vùng lãnh thổ, ${h.continents} châu lục, ${h.provinces}/${h.provincesTotal} tỉnh thành Việt Nam, ${h.places} địa điểm.`,
    `Quốc gia đã đến: ${h.countryNames.join(', ') || '(chưa có)'}`,
    `Tỉnh thành Việt Nam đã đến: ${h.provinceNames.join(', ') || '(chưa có)'}`,
    '',
    'Các hành trình:',
  ];
  if (!h.trips.length) lines.push('- (chưa có hành trình)');
  for (const t of h.trips) {
    lines.push(`- ${oneLine(t.title)} | ${t.dateRange} | ${t.status} | ${t.places.map(oneLine).join(', ') || 'chưa có điểm đến'}`);
  }
  return clip(lines.join('\n'));
}

const BASE_SYSTEM =
  'Bạn là trợ lý du lịch trong ứng dụng TravelMemo, một cuốn nhật ký và hộ chiếu du lịch cá nhân. ' +
  'Luôn trả lời bằng tiếng Việt, giọng thân thiện, ngắn gọn. Chỉ dựa vào dữ liệu người dùng cung cấp; ' +
  'không bịa thêm nơi đã đến, ngày tháng hay sự kiện. Nếu dữ liệu không đủ để trả lời, hãy nói rõ. ' +
  'Viết văn bản thuần, có thể dùng gạch đầu dòng "-", không dùng tiêu đề Markdown hay bảng.';

export const JOURNAL_STYLES = {
  story: { label: 'Kể chuyện', instruction: 'Viết như một câu chuyện du ký liền mạch, 3–5 đoạn.' },
  short: { label: 'Ngắn gọn', instruction: 'Viết ngắn, khoảng 120–180 chữ, đủ ý chính theo thứ tự thời gian.' },
  feeling: { label: 'Cảm xúc', instruction: 'Viết giàu cảm xúc, như một trang nhật ký riêng, 2–4 đoạn.' },
} as const;

export type JournalStyle = keyof typeof JOURNAL_STYLES;

export function journalDraftRequest(context: string, style: JournalStyle): AiRequest {
  return {
    system: `${BASE_SYSTEM} Khi viết nhật ký, viết ở ngôi thứ nhất ("mình"/"tôi"). Không thêm chi tiết không có trong dữ liệu (tên quán, thời tiết, con người); nếu muốn gợi không khí, giữ ở mức chung chung.`,
    prompt: `Dữ liệu hành trình của tôi:\n<du_lieu>\n${context}\n</du_lieu>\n\nHãy viết một bản nháp nhật ký cho hành trình này. ${JOURNAL_STYLES[style].instruction} Dòng đầu tiên là tiêu đề ngắn (không có dấu #), sau đó là nội dung.`,
  };
}

export function askRequest(context: string, question: string): AiRequest {
  return {
    system: BASE_SYSTEM,
    prompt: `Lịch sử du lịch của tôi:\n<du_lieu>\n${context}\n</du_lieu>\n\nCâu hỏi: ${question.trim()}`,
  };
}

export function suggestRequest(context: string, wishes: string): AiRequest {
  const w = wishes.trim();
  return {
    system: `${BASE_SYSTEM} Khi gợi ý điểm đến, ưu tiên nơi người dùng CHƯA đến và giải thích ngắn vì sao hợp với họ dựa trên lịch sử.`,
    prompt: `Lịch sử du lịch của tôi:\n<du_lieu>\n${context}\n</du_lieu>\n\nGợi ý 5 điểm đến tiếp theo cho tôi (có thể trong nước hoặc nước ngoài), mỗi gợi ý gồm tên nơi, quốc gia/tỉnh, thời điểm nên đi và một lý do ngắn.${w ? ` Mong muốn của tôi: ${w}` : ''}`,
  };
}

/** Splits a draft into a title (first line) and body for saving as a journal entry. */
export function splitDraft(text: string): { title: string | null; body: string } {
  const trimmed = text.trim();
  const nl = trimmed.indexOf('\n');
  if (nl < 0) return { title: null, body: trimmed };
  const first = trimmed.slice(0, nl).replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim();
  const body = trimmed.slice(nl + 1).trim();
  if (!body || first.length > 120) return { title: null, body: trimmed };
  return { title: first, body };
}
