<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Rules:

- Dashboard and Discord bot must use same backend.
- No hardcoded Discord responses.
- Device state must include status, wattage, room, lastChanged.
- Realtime dashboard update is required.
- Do not use Mermaid for diagrams.
- Use TypeScript strict mode.
- Add README and .env.example.
<!-- END:nextjs-agent-rules -->
