import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const app = express();
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const maxMb = Number(process.env.MAX_IMAGE_MB || 15);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
    cb(null, allowed.has(file.mimetype));
  }
});

app.use(express.json());
app.use(express.static(path.join(root, 'public')));

function makeDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

function cleanSheetName(name, index) {
  let value = String(name || `Sheet${index + 1}`)
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return value || `Sheet${index + 1}`;
}

function normalizeResult(data) {
  const sheets = Array.isArray(data.sheets) ? data.sheets : [];
  const normalized = sheets.map((sheet, index) => {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const cleanRows = rows.map(row =>
      Array.isArray(row) ? row.map(v => v == null ? '' : String(v)) : [String(row ?? '')]
    );
    const columnCount = Math.max(1, ...cleanRows.map(row => row.length));
    const paddedRows = cleanRows.length
      ? cleanRows.map(row => Array.from({ length: columnCount }, (_, i) => row[i] ?? ''))
      : [['']];
    return {
      name: cleanSheetName(sheet.name, index),
      purpose: String(sheet.purpose || ''),
      rows: paddedRows
    };
  });

  return {
    document_type: String(data.document_type || 'other'),
    summary: String(data.summary || ''),
    sheets: normalized.length
      ? normalized
      : [{ name: 'Sheet1', purpose: 'Extracted information', rows: [['No structured data detected']] }]
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Snap2Sheet API', model });
});

app.post('/api/extract', upload.single('image'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not configured on the server. Add it to your .env file.'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: `Please upload a supported image (PNG, JPG/JPEG, WEBP or GIF), up to ${maxMb} MB.`
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const instructions = `
You are the vision extraction engine for Snap2Sheet.

Your job is NOT to describe the image. Your job is to convert all useful information
visible in the image into logical spreadsheet data.

The uploaded image may be ANY kind of information-containing image:
- normal tables with grid lines
- tables without grid lines
- invoices
- bills and receipts
- bank statements
- financial statements
- calendars
- schedules
- forms
- lists
- reports
- labels
- key-value documents
- mixed documents
- photographs of documents
- screenshots
- documents with uneven spacing or imperfect alignment

First understand the document and its structure. Then produce one or more logical spreadsheet
sheets.

Rules:
1. Read visible text, numbers, dates, amounts and labels carefully.
2. Preserve original spelling, numbers, dates, punctuation and currency symbols when legible.
3. Do not invent information.
4. Preserve blank cells when they are structurally meaningful.
5. For a normal table, keep the original row/column relationships.
6. For a key-value document, use two logical columns such as Field and Value.
7. For mixed documents, use multiple sheets when separate sections are genuinely useful.
8. For calendars/schedules, preserve the positions of blank cells so dates remain aligned.
9. If grid lines are absent, infer structure from alignment and semantic relationships.
10. Do not merge unrelated text merely because it is close together.
11. Return only the structured result required by the JSON schema.
12. If something is unreadable, leave it blank rather than guessing.
`;

  try {
    const response = await client.responses.create({
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: instructions },
          { type: 'input_image', image_url: makeDataUrl(req.file), detail: 'high' }
        ]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'snap2sheet_extraction',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              document_type: {
                type: 'string',
                enum: [
                  'table','invoice','bill','receipt','statement','form',
                  'calendar','schedule','list','report','mixed','text','other'
                ]
              },
              summary: { type: 'string' },
              sheets: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    purpose: { type: 'string' },
                    rows: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    }
                  },
                  required: ['name','purpose','rows']
                }
              }
            },
            required: ['document_type','summary','sheets']
          }
        }
      }
    });

    if (!response.output_text) {
      throw new Error('The AI returned an empty result.');
    }

    let parsed;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new Error('The AI returned invalid structured data.');
    }

    res.json(normalizeResult(parsed));
  } catch (error) {
    console.error('Extraction error:', error);

    const message =
      error?.status === 401 ? 'The OpenAI API key is invalid or unauthorized.' :
      error?.status === 429 ? 'The AI API rate limit or billing limit was reached.' :
      error?.message || 'AI extraction failed.';

    res.status(502).json({ error: message });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Image is too large. Maximum size is ${maxMb} MB.` });
  }
  res.status(400).json({ error: err.message || 'Upload failed.' });
});

app.listen(port, () => {
  console.log(`Snap2Sheet running at http://localhost:${port}`);
  console.log(`Vision model: ${model}`);
});
