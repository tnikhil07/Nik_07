# Snap2Sheet — AI Image to Excel

Snap2Sheet converts information-containing images into editable Excel workbooks.

It is designed for more than traditional grid tables. The AI layer can interpret:
- tables with or without grid lines
- invoices
- bills and receipts
- statements
- calendars
- forms
- schedules
- lists
- reports
- mixed documents
- photographs/screenshots containing structured text

## Architecture

Browser
→ Snap2Sheet backend
→ Vision AI
→ Structured JSON
→ Editable spreadsheet
→ real `.xlsx`

The API key stays on the backend. It is never placed in the frontend.

## Requirements

- Node.js 18+
- An OpenAI API key with API access/billing enabled

## Run locally

1. Open a terminal in this project folder.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` from `.env.example`:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

4. Put your API key into `.env`:

```text
OPENAI_API_KEY=your_key_here
```

5. Start:

```bash
npm start
```

6. Open:

http://localhost:3000

## Important security rule

Never put `OPENAI_API_KEY` inside `public/index.html`, JavaScript, or any browser-side code.

Never commit `.env` to GitHub.

## Deployment

This is a full-stack Node application, so GitHub Pages alone is not enough because GitHub Pages only serves the frontend. Deploy the complete project to a Node-capable host such as Render, Railway, Fly.io, a VPS, or another service that supports Node.js.

Set the environment variable on the hosting service:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

Do not upload your `.env` file.

## How extraction works

The backend sends the uploaded image to a vision-capable OpenAI model through the Responses API. The model is instructed to return structured JSON containing document type, summary, sheets and rows. The browser then turns those rows into editable cells and SheetJS creates the final `.xlsx`.

## Notes

- AI extraction is not guaranteed to be perfect. Users should review the editable cells before downloading.
- The backend currently accepts PNG, JPEG/JPG, WEBP and GIF images.
- The default upload limit is 15 MB.
- You can change the model with `OPENAI_MODEL` in `.env`.

## OpenAI API documentation

See the official OpenAI developer documentation for API keys, image inputs, Responses API and models:
https://platform.openai.com/docs/quickstart/make-your-first-api-request
