import type { DeckModel } from '@/types/documents';
import { uid } from '@/utils';

export interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  build: () => DeckModel;
}

const slide = (
  layout: DeckModel['slides'][number]['layout'],
  title: string,
  body: string,
  second?: string,
): DeckModel['slides'][number] => ({ id: uid('slide'), layout, title, body, ...(second ? { second } : {}) });

/**
 * Deck templates. Every slide is a normal, editable slide afterwards — the
 * template is only the starting point, not a locked theme.
 */
export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'product',
    name: 'Product pitch',
    description: 'Problem, solution, demo, pricing, ask.',
    build: () => ({
      title: 'Product pitch',
      theme: 'midnight',
      slides: [
        slide('title', 'Product name', 'One sentence that explains what it does'),
        slide('bullets', 'The problem', "Who feels it\nHow often\nWhat it costs today"),
        slide('bullets', 'Our solution', 'What we built\nWhy it is different\nWhat is already working'),
        slide('two-column', 'How it works', 'Describe the flow in three steps', 'And what happens on the server'),
        slide('bullets', 'Traction', 'Numbers you can defend\nWhat changed in the last quarter'),
        slide('title', 'The ask', 'What you need and by when'),
      ],
    }),
  },
  {
    id: 'lecture',
    name: 'Lecture',
    description: 'Title, agenda, three chapters and a summary.',
    build: () => ({
      title: 'Lecture',
      theme: 'paper',
      slides: [
        slide('title', 'Course title', 'Lecture 01 · Lecturer'),
        slide('bullets', 'Agenda', 'Chapter one\nChapter two\nChapter three\nReading list'),
        slide('title-body', 'Chapter one', 'The core idea in one paragraph, then the details.'),
        slide('title-body', 'Chapter two', 'A worked example with real numbers.'),
        slide('title-body', 'Chapter three', 'Where this shows up outside the classroom.'),
        slide('bullets', 'Summary', 'Three things to remember\nOne question for next week'),
      ],
    }),
  },
  {
    id: 'report',
    name: 'Quarterly report',
    description: 'Results, metrics, risks and next steps.',
    build: () => ({
      title: 'Quarterly report',
      theme: 'ocean',
      slides: [
        slide('title', 'Quarterly report', 'Q3 · Company name'),
        slide('bullets', 'Highlights', 'Revenue\nCustomers\nProduct shipped'),
        slide('two-column', 'What worked', 'Three wins with numbers', 'What we would repeat'),
        slide('two-column', 'What did not', 'Three misses, honestly', 'What we changed because of them'),
        slide('bullets', 'Next quarter', 'Top three priorities\nOwners\nBudget'),
      ],
    }),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'One idea per slide, nothing else.',
    build: () => ({
      title: 'Presentation',
      theme: 'mint',
      slides: [slide('title', 'A big idea', 'One line of context'), slide('title-body', 'And the detail', 'Keep it short.')],
    }),
  },
];
