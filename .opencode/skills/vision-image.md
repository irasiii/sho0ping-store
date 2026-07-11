---
name: vision-image
description: Use when the user provides an image file (e.g. image.png) and wants it described or analyzed, especially screenshots of the store UI, search results, or product photos. The agent cannot see images directly, so this skill sends the image to Google Gemini's vision model and returns a text description the agent can act on.
---

# Vision Image Analysis

The agent model has no direct image input. When the user supplies an image file path
(e.g. `C:\sho0ping-store\image.png` or `image.png` in the repo), analyze it with Gemini
vision instead of trying to view it.

## How to use

Run the helper with Node (the project already has Node 18+ with global fetch):

```
node tools/vision.js <imagePath> [optional prompt]
```

- The key is read from `GEMINI_API_KEY` (env) or `gimini-key.txt` in the repo root.
  Never print or commit the key.
- The script prints a text description to stdout and also saves it to `.vision-last.txt`.
- In WSL/Docker, the repo is at `/root/app/sho0ping-store`; run the same command there.

## Workflow

1. Confirm the image file exists on disk (the user may need to drop `image.png` into the
   repo folder — chat attachments are NOT visible to the agent).
2. Run the command above.
3. Read the returned description and act on the user's request (fix UI, identify the
   product/error shown, etc.).
4. If Gemini returns an auth error, tell the user the key is invalid and to get a real
   one from https://aistudio.google.com/apikey (starts with `AIza`).
