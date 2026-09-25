# Deployment checklist

1. Push this folder to GitHub.
2. Deploy the repository on a Node.js-capable hosting service.
3. Set:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
   - `MAX_IMAGE_MB` (optional)
4. Start command:
   `npm start`
5. Do not use GitHub Pages for the full-stack app; it cannot run `server/server.js`.
