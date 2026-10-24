import { getAllStructuredSections } from './guideData';
import { richToPlainText } from './markup';

export interface ResumeStep {
  /** localStorage key written by StepChecklist */
  key: string;
  guideId: string;
  guideTitle: string;
  stepNum: string | number;
  text: string;
}

const FIRST_WALKTHROUGH_ID = 'w-1-01';

/**
 * Ordered list of every walkthrough step (`w-*` pages with a checklist), following the
 * guide's own prev/next chain so the order matches the order the player reads it in.
 */
export function getResumeSteps(): ResumeStep[] {
  const byId = new Map<string, any>(
    getAllStructuredSections()
      .map((s) => s.data.guide)
      .filter(Boolean)
      .map((g) => [g.id as string, g]),
  );

  const ordered: any[] = [];
  const seen = new Set<string>();
  let node = byId.get(FIRST_WALKTHROUGH_ID);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    if (node.id.startsWith('w-') && node.steps?.length) ordered.push(node);
    node = byId.get(node.navigation?.next?.id);
  }

  return ordered.flatMap((g) =>
    g.steps.map((st: any): ResumeStep => {
      const stepNum = st.step_number || st.id;
      return {
        key: `sh-step-${g.id}-${stepNum}`,
        guideId: g.id,
        guideTitle: g.title,
        stepNum,
        text: richToPlainText(st.description || st.instruction)
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    }),
  );
}
