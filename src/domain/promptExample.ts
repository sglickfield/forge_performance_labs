/**
 * Few-shot example stuffed into the Grok prompt (quality/length bar).
 * Not the eval gold — that is golden_datasets/*.pdf.
 */
export const PROMPT_EXAMPLE = `
HEADLINE
Standout explosive speed and power

OVERVIEW
Aisha completed a full battery of field tests focused on sprint speed, lower-body power, upper-body grip, isometric strength, flexibility, and single-leg balance. Results are compared against the typical range published for recreational-to-competitive female athletes aged 18–29 (Forge Coach Handbook, 2019, Appendix C). These ranges describe common performance bands rather than elite standards; scores outside the band are highlighted as Superior when they indicate higher athletic capacity in the direction that benefits the test.

TAKEAWAYS
Standout strengths — explosive speed and power.
Aisha’s 40 m sprint (5.02 s), vertical jump (49 cm), and broad jump (208 cm) all sit above the typical range for her age and sex. These three metrics are highly relevant to sprint performance and indicate excellent reactive strength and acceleration capacity relative to the recreational-to-competitive peer group.

Solid foundation in supporting qualities.
Grip strength (29–30 kg), sit-and-reach (8 cm), and single-leg balance (28–30 s) all fall comfortably inside the typical band. There is no current deficit that would be expected to limit sprint development, though modest improvements in flexibility and balance symmetry can still support injury resilience and technical consistency.

Isometric strength baseline established.
The mid-thigh pull of 1,980 N provides a useful force-production reference for future testing. Tracking this value over time will help monitor strength adaptations from training blocks. It is not graded against a handbook range, because none exists.

RECOMMENDATIONS
Given the clear superiority in speed and power metrics, programming should continue to emphasize quality sprint work, plyometrics, and resisted acceleration while protecting the qualities already present.

Speed and power maintenance / progression.
Maintain high-intensity sprint volumes with adequate recovery. Continue vertical and horizontal plyometric progressions; consider adding contrast or complex training pairs once technical quality is consistent.

Strength support.
Use the mid-thigh pull as a monitoring tool. A well-rounded lower-body strength program (including hip hinge and single-leg patterns) will support continued force production and transfer to sprinting.

Mobility and balance polish.
Sit-and-reach is mid-range; targeted hamstring and hip-flexor mobility work can improve sprint mechanics and reduce soft-tissue risk. Slight left/right balance asymmetry (30 s vs 28 s) is minor — single-leg stability drills can equalize and reinforce landing control.

Retest cadence.
Re-test the full battery in 8–12 weeks after a focused training block to quantify adaptation, especially the three superior power/speed markers and the mid-thigh pull.

CAVEATS
(none — the sheet is complete and clean. Do not invent caveats.)
`.trim()
