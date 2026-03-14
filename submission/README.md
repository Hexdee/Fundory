# Fundory Submission Pack

This folder contains ready assets and draft content for both:
- Bonzo bounty form
- Hedera main track form (Theme 1: AI & Agents)

## Files
- `BOUNTY_SUBMISSION_DRAFT.md` - paste-ready draft for bounty form fields.
- `HEDERA_TRACK_SUBMISSION_DRAFT.md` - paste-ready draft for main track fields.
- `FORM_ANSWERS.md` - final copy/paste answer sheet matching both forms.
- `DEMO_CHECKLIST.md` - final checklist before submission.
- `VERIFICATION_LOG.md` - local compile/build/smoke verification evidence.
- `pitch-deck.html` - editable pitch deck source.
- `pitch-deck.pdf` - generated pitch deck for upload.
- `fundory-demo.webm` - generated demo video artifact.

## Regenerate assets

From `app/` (recommended in production mode):
```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

In another terminal (`app/`):
```bash
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:record
DEMO_BASE_URL=http://127.0.0.1:3000 npm run demo:responsive
npm run deck:pdf
```

## Required placeholders to fill before submit
- Demo URL
- Public video URL (upload `fundory-demo.webm`)
- Public repo latest-commit URL
- Discord and LinkedIn details
- Hedera testnet account ID and tx proof
- Team member wallet/handle/profile lists
