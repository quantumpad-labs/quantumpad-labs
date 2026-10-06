# EXAFLOP agent instructions

## Design and image skills

Use the vendored TasteSkill v2 and relevant companion skills whenever work calls for UI/UX, visual design, branding, image generation, or image-to-code implementation. These are in `.agents/skills/` and also installed in the user's Codex skill directories.

Read the applicable `SKILL.md` before applying it. Briefly tell the user which skill is being used. Select by the actual deliverable and scope, not just keywords. Do not apply every skill to every task.

| Deliverable | Skill source |
| --- | --- |
| Landing pages, portfolios, visual redesigns | `.agents/skills/design-taste-frontend/SKILL.md` (TasteSkill v2) |
| Audit and improve an existing interface | `.agents/skills/redesign-existing-projects/SKILL.md` |
| Relevant typography, spacing, component detail and motion | `.agents/skills/high-end-visual-design/SKILL.md` |
| Restrained editorial or minimal product interfaces | `.agents/skills/minimalist-ui/SKILL.md` |
| Mechanical, sharp terminal interfaces where the brief calls for it | `.agents/skills/industrial-brutalist-ui/SKILL.md` |
| Expressive frontend layouts and motion when explicitly appropriate | `.agents/skills/gpt-taste/SKILL.md` |
| Substantial visual implementation from generated references | `.agents/skills/image-to-code/SKILL.md` |
| Website concept images | `.agents/skills/imagegen-frontend-web/SKILL.md` |
| Mobile concept images and flows | `.agents/skills/imagegen-frontend-mobile/SKILL.md` |
| Brand identity, logo exploration and brand boards | `.agents/skills/brandkit/SKILL.md` |

Respect TasteSkill v2's exclusions: it is not the default for dashboards, data tables, code editors, or complex multistep product forms. EXAFLOP contains dense product screens; preserve their clarity, real data, accessible interactions and functional behavior. Use relevant companion guidance for those surfaces without imposing marketing-page patterns.

Use the available image-generation capability for image creation and editing. Reference images do not replace functional implementation. Small functional fixes do not require image generation or a redesign.

User instructions, existing project requirements, accessibility, performance, security and functional correctness take precedence over aesthetic defaults. Preserve EXAFLOP's established visual language unless a redesign is requested. Do not alter provider billing, credentials, wallet authorization or truthful data presentation to satisfy design preferences.

## Provenance

The skill sources are from `Leonxlnx/taste-skill`, pinned in `.agents/skills/taste-skill-source.json`. Upstream calls the default v2 experimental, not a stable v2.0.0 release. Preserve the MIT license and provenance when updating.
