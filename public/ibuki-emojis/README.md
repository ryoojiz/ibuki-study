# Ibuki inline emoji assets

Place PNG assets in this directory. The chat renderer turns either token format in an AI response into the matching asset: :name: or :ibuki_name:.

- `:smile:` or `:ibuki_smile:` -> `smile.png`
- `:ibuki_thinking:` -> `thinking.png` (legacy `:ibuki_think:` also works)
- `:ibuki_idea:` -> `idea.png`
- `:ibuki_study:` -> `study.png`
- `:ibuki_sparkle:` -> `sparkle.png`
- `:ibuki_celebrate:` -> `celebrate.png`
- `:ibuki_encourage:` -> `encourage.png`
- `:ibuki_empathy:` -> `empathy.png`
- `:ibuki_look:` -> `look.png`
- `:ibuki_guide:` -> `guide.png`
- `:ibuki_hint:` -> `hint.png`
- `:ibuki_growth:` -> `growth.png`

Naming rules: use lower-case letters, numbers, hyphens, or underscores. For example, `exam-ready.png` is available to the renderer as `:ibuki_exam-ready:`. PNG with transparency is recommended. Tokens are unlimited per assistant message; `MAX_INLINE_EMOJIS_PER_MESSAGE` in `ChatView.vue` is intentionally `null` and is the future central limit switch.